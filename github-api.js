// Petit client pour l'API GitHub — miroir de ForgejoApi (api.js), même surface de
// méthodes pour que app.js/site-builder.js appellent l'un ou l'autre sans distinction
// (voir providers.js pour le choix du bon client selon le fournisseur connecté).
// Doc : https://docs.github.com/en/rest
//
// Différences avec ForgejoApi qui restent internes à cette classe (jamais exposées aux
// appelants) :
// - createBranch() : GitHub n'a pas d'endpoint "créer une branche" en un seul appel comme
//   Gitea/Forgejo — il faut lire le sha de la branche de base puis créer une ref.
// - saveFile() : l'API "contents" de GitHub utilise toujours PUT (création et mise à
//   jour), alors que Forgejo distingue POST (création) / PUT (mise à jour).
// - publishFiles() : Forgejo expose un endpoint batch dédié ("Modify multiple files")
//   sur l'API "contents" ; GitHub n'a pas d'équivalent, donc ce commit est composé à la
//   main via l'API Git Data (blob par fichier, arbre, commit, puis avancement de la
//   branche) — voir le commentaire sur GitHubApi.publishFiles ci-dessous.
// - enablePublishing() : pas de webhook, un appel dédié à l'API Pages.
// - pagesUrl()/repoUrl() : formes d'URL propres à GitHub.

// Décode le base64 renvoyé par getBlob() en bytes bruts (contrairement à
// decodeBase64Utf8 dans site-builder.js, qui suppose du texte UTF-8) — utilisé pour les
// fichiers binaires (polices, images) que fetchRepoArchive() ne peut pas obtenir via
// GraphQL (voir ce commentaire plus bas).
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

class GitHubApi {
  static providerId = "github";
  static providerLabel = "GitHub";

  constructor(token) {
    this.token = token;
    this.base = "https://api.github.com";
  }

  async _request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${this.base}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
    } catch (networkErr) {
      console.error(`Network error sur ${path}:`, networkErr);
      throw new Error(`Impossible de contacter ${GitHubApi.providerLabel} — vérifie ta connexion et réessaie.`);
    }

    if (!response.ok) {
      if (!(response.status === 404 && options.silent404)) {
        console.error(`API error (${response.status}) sur ${path}:`, await response.text());
      }
      const err = new Error(friendlyApiError(response.status, GitHubApi.providerLabel));
      err.status = response.status;
      throw err;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  getCurrentUser() {
    return this._request("/user");
  }

  // Dépôts accessibles par l'utilisateur connecté (possédés, collaborations, orgs —
  // comportement par défaut de GitHub sans filtre `affiliation`, pour rester proche de
  // ce que renvoie ForgejoApi.listRepos()).
  listRepos() {
    return this._request("/user/repos?per_page=50");
  }

  // Crée un nouveau dépôt (public, avec un premier commit) pour un nouveau site
  createRepo(name) {
    return this._request("/user/repos", {
      method: "POST",
      body: JSON.stringify({ name, auto_init: true, private: false }),
    });
  }

  // Crée une branche à partir d'une autre (utilisé pour la branche "pages"). GitHub
  // n'offrant pas d'endpoint direct pour ça, on lit d'abord le sha de la branche de
  // base (via sa ref `heads/<branche>`) puis on crée la nouvelle ref à ce même sha.
  async createBranch(owner, repo, newBranchName, oldBranchName) {
    const baseRef = await this._request(`/repos/${owner}/${repo}/git/ref/heads/${oldBranchName}`);
    return this._request(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${newBranchName}`, sha: baseRef.object.sha }),
    });
  }

  // Active GitHub Pages sur la branche "pages" du dépôt — équivalent du webhook Codeberg
  // (createPagesWebhook côté ForgejoApi), mais ici un appel dédié à l'API Pages plutôt
  // qu'un webhook générique.
  enablePublishing(owner, repo) {
    return this._request(`/repos/${owner}/${repo}/pages`, {
      method: "POST",
      body: JSON.stringify({ build_type: "legacy", source: { branch: "pages", path: "/" } }),
    });
  }

  // Récupère un fichier (contenu encodé en base64 par l'API). `silent404` : ne pas logger
  // en erreur console un 404 ici (utilisé pour de simples vérifications d'existence).
  getFile(owner, repo, path, ref, { silent404 = false } = {}) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return this._request(`/repos/${owner}/${repo}/contents/${path}${query}`, { silent404 });
  }

  // Arbre complet d'une branche en un seul appel (chemin, type, sha, taille de chaque
  // entrée) — utilisé par fetchRepoArchive() (liste des chemins à batcher en GraphQL) et
  // publishFiles() (distinction create/update par chemin). `truncated` dans la réponse
  // signale un dépôt trop gros pour tenir dans une seule page ; à vérifier par l'appelant.
  listTree(owner, repo, ref) {
    return this._request(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  }

  // Contenu d'un blob par son sha (même forme `{content: base64}` que getFile, mais sans
  // passer par un chemin — utile une fois le sha connu via listTree()).
  getBlob(owner, repo, sha) {
    return this._request(`/repos/${owner}/${repo}/git/blobs/${sha}`);
  }

  // Sha du commit HEAD d'une branche — vérification légère utilisée par repo-cache.js
  // pour savoir si la copie locale (IndexedDB) est encore à jour, sans retélécharger
  // tout le dépôt. Alias public de _headCommitSha (déjà utilisée en interne par
  // publishFiles) pour rester cohérent avec la même méthode côté ForgejoApi/GitLabApi.
  getHeadSha(owner, repo, branch) {
    return this._headCommitSha(owner, repo, branch);
  }

  // Archive complète d'une branche en un seul aller-retour "logique" (thème + contenu,
  // voir docs/plan-lecture-content-batch.md) — mais PAS via l'endpoint archive/tarball :
  // celui-ci redirige vers codeload.github.com, dont le CORS n'autorise que
  // render.githubusercontent.com (vérifié en direct), bloqué depuis notre origine, sans
  // backend à nous pour proxifier. Alternative retenue : listTree() (déjà 1 appel) puis
  // UNE requête GraphQL avec un alias par fichier (`object(expression: "ref:path")`),
  // CORS ouvert vérifié sur api.github.com/graphql. Limite du type Blob de l'API GraphQL
  // GitHub : `text` vaut `null` pour un blob binaire (pas de champ contenu en base64) —
  // les fichiers marqués `isBinary` (polices, images du thème) retombent donc sur
  // getBlob() (REST, base64) un par un, en plus de l'unique requête GraphQL groupée pour
  // tout le reste (Markdown, HTML, CSS, JSON...).
  async fetchRepoArchive(owner, repo, ref) {
    const tree = await this.listTree(owner, repo, ref);
    if (tree.truncated) {
      throw new Error("Le dépôt est trop volumineux pour être parcouru en un seul appel.");
    }
    const entries = tree.tree.filter((entry) => entry.type === "blob");
    if (!entries.length) return {};

    const { files, binaryPaths } = await this._fetchBlobsViaGraphQL(owner, repo, ref, entries);
    await Promise.all(
      binaryPaths.map(async (path) => {
        const entry = entries.find((e) => e.path === path);
        const blob = await this.getBlob(owner, repo, entry.sha);
        files[path] = base64ToBytes(blob.content);
      })
    );
    return files;
  }

  // Limite de complexité de requête GraphQL GitHub : on chunk plutôt que d'envoyer un
  // alias par fichier d'un dépôt arbitrairement gros en une seule requête.
  async _fetchBlobsViaGraphQL(owner, repo, ref, entries) {
    const CHUNK_SIZE = 200;
    const files = {};
    const binaryPaths = [];

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      const fields = chunk
        .map(
          (entry, idx) =>
            `f${idx}: object(expression: ${JSON.stringify(`${ref}:${entry.path}`)}) { ... on Blob { text isBinary } }`
        )
        .join("\n");
      const query = `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { ${fields} } }`;

      const data = await this._graphqlRequest(query);
      chunk.forEach((entry, idx) => {
        const blob = data.repository[`f${idx}`];
        if (!blob || blob.isBinary || blob.text === null) {
          binaryPaths.push(entry.path);
        } else {
          files[entry.path] = new TextEncoder().encode(blob.text);
        }
      });
    }

    return { files, binaryPaths };
  }

  async _graphqlRequest(query) {
    let response;
    try {
      response = await fetch(`${this.base}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
    } catch (networkErr) {
      console.error("Network error sur /graphql:", networkErr);
      throw new Error(`Impossible de contacter ${GitHubApi.providerLabel} — vérifie ta connexion et réessaie.`);
    }
    if (!response.ok) {
      console.error(`API error (${response.status}) sur /graphql:`, await response.text());
      const err = new Error(friendlyApiError(response.status, GitHubApi.providerLabel));
      err.status = response.status;
      throw err;
    }
    const body = await response.json();
    if (body.errors) {
      console.error("GraphQL errors sur /graphql:", body.errors);
      throw new Error(friendlyApiError(500, GitHubApi.providerLabel));
    }
    return body.data;
  }

  // Écrit plusieurs fichiers en un seul commit. Contrairement à Forgejo, l'API "contents"
  // de GitHub n'a pas d'endpoint batch — on compose le commit à la main via l'API Git Data
  // (créer un blob par fichier, un arbre, un commit, puis avancer la branche), l'équivalent
  // bas niveau de ce que fait `git commit` — mais en pur REST/JSON, donc utilisable depuis
  // le navigateur (contrairement au protocole git smart-HTTP, voir README.md). `base_tree`
  // reprend l'arbre existant de la branche pour ne pas perdre les fichiers non touchés par
  // cette publication (mêmes fichiers que list/publishFile ignorait déjà auparavant).
  async publishFiles(owner, repo, branch, files) {
    const headSha = await this._headCommitSha(owner, repo, branch);
    const baseCommit = await this._request(`/repos/${owner}/${repo}/git/commits/${headSha}`);

    const treeEntries = await Promise.all(
      Object.entries(files).map(async ([path, bytes]) => {
        const blob = await this._request(`/repos/${owner}/${repo}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: bytesToBase64(bytes), encoding: "base64" }),
        });
        return { path, sha: blob.sha, mode: "100644", type: "blob" };
      })
    );

    const tree = await this._request(`/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
    });

    const commit = await this._request(`/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ tree: tree.sha, parents: [headSha], message: "Publication du site" }),
    });

    return this._request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });
  }

  async _headCommitSha(owner, repo, branch) {
    const ref = await this._request(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    return ref.object.sha;
  }

  // Crée ou met à jour un fichier. `sha` requis uniquement si le fichier existe déjà.
  // Contrairement à Forgejo, l'API GitHub utilise PUT dans les deux cas — seul le corps
  // de la requête (présence de `sha`) distingue création et mise à jour.
  async saveFile(owner, repo, path, content, { sha, message, branch = "main" } = {}) {
    const body = {
      content: btoa(unescape(encodeURIComponent(content))), // encode UTF-8 -> base64
      message: message || (sha ? `Mise à jour de ${path}` : `Création de ${path}`),
      branch,
    };
    if (sha) body.sha = sha;

    return this._request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  // Conflit d'édition simultanée : l'API contents de GitHub répond 409 quand le sha envoyé
  // ne correspond plus au fichier côté serveur (contrairement à Forgejo/Codeberg, qui
  // répondent 422 pour le même cas — voir ForgejoApi.isConflict).
  isConflict(err) {
    return err.status === 409;
  }

  // URL publique du site une fois publié sur GitHub Pages :
  // https://{owner}.github.io/{repo}/, sauf si le dépôt s'appelle "{owner}.github.io"
  // (site racine de l'utilisateur·rice, insensible à la casse).
  pagesUrl(owner, repo) {
    const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
    return isUserSite ? `https://${owner.toLowerCase()}.github.io/` : `https://${owner.toLowerCase()}.github.io/${repo}/`;
  }

  // URL du dépôt lui-même sur GitHub (page web, pas API) — utilisé par l'écran Réglages
  // du site pour afficher un lien "Voir le dépôt".
  repoUrl(owner, repo) {
    return `https://github.com/${owner}/${repo}`;
  }

  // Supprime le dépôt entier — irréversible, nécessite le scope OAuth "delete_repo".
  deleteRepo(owner, repo) {
    return this._request(`/repos/${owner}/${repo}`, { method: "DELETE" });
  }
}
