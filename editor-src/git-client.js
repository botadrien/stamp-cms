// Client git réel (isomorphic-git), qui remplace l'API REST "contents" de Forgejo pour
// tout ce qui touche au contenu d'un dépôt (lecture, écriture, publication) : un seul
// clone/fetch + un seul push remplacent N requêtes GET/PUT par fichier. Bundlé en IIFE
// sur window.GitClient (même principe que editor-src/zola-builder.js).
//
// Codeberg ne renvoie pas d'en-tête CORS sur ses endpoints git smart-HTTP
// (*.git/info/refs, git-upload-pack, git-receive-pack), contrairement à /api/v1/* — d'où
// `CONFIG.corsProxy`, qui pointe vers https://cors.isomorphic-git.org en prod (proxy
// gratuit communautaire, sans garantie de service) et reste vide en test (voir
// e2e/Caddyfile, qui CORS-active déjà tout Forgejo local).
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import LightningFS from "@isomorphic-git/lightning-fs";
import { Buffer } from "buffer";

// isomorphic-git suppose l'environnement Node et utilise `Buffer` sans l'importer
// (global implicite côté Node) — absent des navigateurs, d'où ce polyfill explicite,
// sans quoi le premier appel réseau échoue avec "Missing Buffer dependency" (repéré via
// un test e2e qui masquait ça derrière le message générique "Impossible de contacter
// Codeberg", err.code étant `undefined` pour cette erreur-là).
globalThis.Buffer = Buffer;

const fs = new LightningFS("cmstatic-git");
const pfs = fs.promises;

// Identité utilisée pour chaque commit — pas de granularité par utilisateur·rice pour
// l'instant (contrairement à l'API REST, qui attribuait chaque commit au compte
// authentifié automatiquement) : un contournement plus fin nécessiterait de faire
// remonter l'utilisateur·rice courant·e jusqu'ici, pas fait pour l'instant.
const COMMIT_AUTHOR = { name: "CMS Statique", email: "cms-statique@no-reply.invalid" };

function dirFor(owner, repo, branch) {
  return `/repos/${owner}/${repo}/${branch}`;
}

function remoteUrl(owner, repo) {
  return `${CONFIG.instanceUrl}/${owner}/${repo}.git`;
}

// Cf. groundwork confirmé par un test manuel (git clone/push en ligne de commande) :
// Forgejo/Codeberg acceptent un token OAuth2 comme identifiant HTTP basique, mot de
// passe arbitraire (convention "x-oauth-basic", héritée du support GitHub côté Gitea).
async function onAuth() {
  const token = getStoredToken();
  return { username: token, password: "x-oauth-basic" };
}

// Messages non-techniques par défaut, même règle que friendlyApiError() dans api.js —
// jamais de message brut d'isomorphic-git (souvent en anglais, parfois très technique,
// ex. "Push rejected because it was not a simple fast-forward...") affiché tel quel.
// err.code est préservé sur l'erreur relancée pour que les appelants puissent affiner
// (ex. un message plus spécifique sur un PushRejectedError lors de l'édition d'une page).
function friendlyGitErrorMessage(err) {
  if (err.code === "PushRejectedError") {
    return "Ce contenu a été modifié entre-temps ailleurs.";
  }
  if (err.code === "HttpError") {
    const status = err.data && err.data.statusCode;
    if (status === 401) return "Ta session a expiré, reconnecte-toi.";
    if (status === 403) return "Tu n'as pas les droits nécessaires pour cette action.";
    if (status === 404) return "Introuvable — ça a peut-être été supprimé ou déplacé.";
    if (status >= 500) return "Codeberg rencontre un problème de son côté, réessaie dans un instant.";
    return "Une erreur est survenue, réessaie.";
  }
  return "Impossible de contacter Codeberg — vérifie ta connexion et réessaie.";
}

async function withFriendlyErrors(action) {
  try {
    return await action();
  } catch (err) {
    if (err.code === "ENOENT") throw err; // pas une erreur réseau, laissée telle quelle (voir readFile)
    console.error("Erreur git :", err);
    const friendly = new Error(friendlyGitErrorMessage(err));
    friendly.code = err.code;
    if (err.data && typeof err.data.statusCode === "number") friendly.status = err.data.statusCode;
    throw friendly;
  }
}

async function pathExists(path) {
  try {
    await pfs.stat(path);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
}

async function ensureParentDir(filePath) {
  const parts = filePath.split("/").slice(1, -1); // enlève le "" initial et le nom de fichier
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    if (!(await pathExists(current))) {
      await pfs.mkdir(current);
    }
  }
}

// Clone si jamais fait localement, sinon fetch + reset dur sur l'état distant — jamais de
// merge/rebase local : ce dossier n'est qu'une copie de travail éphémère, jamais de commit
// local qui survit à un push raté (voir commitAndPush, qui nettoie sur échec).
async function sync(owner, repo, branch) {
  await withFriendlyErrors(async () => {
    const dir = dirFor(owner, repo, branch);
    const url = remoteUrl(owner, repo);

    if (await pathExists(`${dir}/.git`)) {
      const { fetchHead } = await git.fetch({
        fs,
        http,
        dir,
        url,
        ref: branch,
        singleBranch: true,
        depth: 1,
        corsProxy: CONFIG.corsProxy,
        onAuth,
      });
      await git.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: fetchHead, force: true });
      await git.checkout({ fs, dir, ref: branch, force: true });
    } else {
      await git.clone({
        fs,
        http,
        dir,
        url,
        ref: branch,
        singleBranch: true,
        depth: 1,
        corsProxy: CONFIG.corsProxy,
        onAuth,
      });
    }
  });
}

// Parcourt récursivement un sous-dossier de la copie de travail locale (ex. "content") et
// retourne les chemins relatifs au dépôt (ex. "content/blog/mon-article.md") de tous les
// fichiers trouvés, en ignorant .git.
async function listFiles(owner, repo, branch, subdir) {
  const dir = dirFor(owner, repo, branch);
  const results = [];

  async function walk(relPath) {
    const absPath = `${dir}/${relPath}`;
    if (!(await pathExists(absPath))) return;
    const entries = await pfs.readdir(absPath);
    for (const entry of entries) {
      if (entry === ".git") continue;
      const entryRelPath = relPath ? `${relPath}/${entry}` : entry;
      const stat = await pfs.stat(`${absPath}/${entry}`);
      if (stat.isDirectory()) {
        await walk(entryRelPath);
      } else {
        results.push(entryRelPath);
      }
    }
  }

  await walk(subdir);
  return results;
}

// `binary` : false (défaut) décode en UTF-8 (Markdown, config.toml...), true retourne les
// octets bruts tels quels (sortie du build Zola, mélange HTML/CSS généré et assets
// binaires — voir zola-builder.js).
async function readFile(owner, repo, branch, path, { binary = false } = {}) {
  const dir = dirFor(owner, repo, branch);
  try {
    const data = await pfs.readFile(`${dir}/${path}`, binary ? undefined : "utf8");
    return data;
  } catch (err) {
    if (err.code === "ENOENT") {
      const notFound = new Error("Introuvable — ça a peut-être été supprimé ou déplacé.");
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
}

async function writeFile(owner, repo, branch, path, content) {
  const dir = dirFor(owner, repo, branch);
  const fullPath = `${dir}/${path}`;
  await ensureParentDir(fullPath);
  await pfs.writeFile(fullPath, content);
}

async function remove(owner, repo, branch, path) {
  const dir = dirFor(owner, repo, branch);
  if (await pathExists(`${dir}/${path}`)) {
    await pfs.unlink(`${dir}/${path}`);
  }
}

// git add -A + commit + push, façon isomorphic-git (statusMatrix pour détecter
// ajouts/modifs/suppressions). Laisse remonter les erreurs d'isomorphic-git telles
// quelles (err.code === "PushRejectedError" sur un push non fast-forward,
// err.code === "HttpError" sur un échec de transport) — c'est aux appelants de les
// traduire en message clair. Sur un push refusé, on ne laisse pas le commit local
// orphelin traîner : le prochain sync() le remplacera de toute façon (fetch + reset dur),
// donc rien à nettoyer explicitement ici.
async function commitAndPush(owner, repo, branch, message) {
  const dir = dirFor(owner, repo, branch);
  const matrix = await git.statusMatrix({ fs, dir });
  for (const [filepath, head, workdir] of matrix) {
    if (workdir === 0) {
      await git.remove({ fs, dir, filepath });
    } else if (head !== workdir) {
      await git.add({ fs, dir, filepath });
    }
  }
  await git.commit({ fs, dir, message, author: COMMIT_AUTHOR });
  await withFriendlyErrors(() =>
    git.push({ fs, http, dir, remote: "origin", ref: branch, corsProxy: CONFIG.corsProxy, onAuth })
  );
}

// Crée newBranch côté distant à partir de l'état local déjà synchronisé de fromBranch
// (remplace l'ancien api.createBranch REST) — pousse directement fromBranch vers
// refs/heads/newBranch sans avoir besoin d'une copie de travail séparée pour newBranch.
async function createBranch(owner, repo, newBranch, fromBranch) {
  const dir = dirFor(owner, repo, fromBranch);
  await withFriendlyErrors(() =>
    git.push({
      fs,
      http,
      dir,
      remote: "origin",
      ref: fromBranch,
      remoteRef: newBranch,
      corsProxy: CONFIG.corsProxy,
      onAuth,
    })
  );
}

export { sync, listFiles, readFile, writeFile, remove, commitAndPush, createBranch };
