// Petit client pour l'API Forgejo (compatible Codeberg).
// Doc : https://codeberg.org/api/swagger

// Messages non-techniques par défaut selon le code HTTP — jamais de JSON/stack trace
// brut affiché à l'utilisateur·rice (voir docs/objective.md, section "Gestion des
// erreurs"). Les cas qui ont besoin de plus de contexte (ex. conflit d'édition, nom de
// site déjà pris) sont affinés au niveau des appelants via `err.status`.
// `providerLabel` : nom du fournisseur affiché dans le message 5xx (ex. "Codeberg",
// "GitHub") — chaque client API passe le sien, voir ForgejoApi/GitHubApi.
function friendlyApiError(status, providerLabel) {
  if (status === 401) return "Ta session a expiré, reconnecte-toi.";
  if (status === 403) return "Tu n'as pas les droits nécessaires pour cette action.";
  if (status === 404) return "Introuvable — ça a peut-être été supprimé ou déplacé.";
  if (status === 409) return "Ce contenu a changé entre-temps ailleurs.";
  if (status === 422) return "Cette action n'est pas possible telle quelle.";
  if (status >= 500) return `${providerLabel} rencontre un problème de son côté, réessaie dans un instant.`;
  return "Une erreur est survenue, réessaie.";
}

// btoa(String.fromCharCode(...bytes)) plante sur de gros fichiers (dépassement de la
// pile d'appel) — on construit la chaîne binaire par blocs.
function bytesToBase64(bytes) {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

class ForgejoApi {
  static providerId = "codeberg";
  static providerLabel = "Codeberg";

  constructor(token) {
    this.token = token;
    this.base = `${CONFIG.instanceUrl}/api/v1`;
  }

  async _request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${this.base}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
    } catch (networkErr) {
      console.error(`Network error sur ${path}:`, networkErr);
      throw new Error(`Impossible de contacter ${ForgejoApi.providerLabel} — vérifie ta connexion et réessaie.`);
    }

    if (!response.ok) {
      // silent404 : un 404 ici fait partie du fonctionnement normal de l'appelant (ex.
      // vérifier si un fichier existe déjà avant de le créer) — pas la peine de polluer
      // la console avec une "erreur" qui n'en est pas une.
      if (!(response.status === 404 && options.silent404)) {
        console.error(`API error (${response.status}) sur ${path}:`, await response.text());
      }
      const err = new Error(friendlyApiError(response.status, ForgejoApi.providerLabel));
      err.status = response.status;
      throw err;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  getCurrentUser() {
    return this._request("/user");
  }

  // Dépôts accessibles par l'utilisateur connecté
  listRepos() {
    return this._request("/user/repos?limit=50");
  }

  // Crée un nouveau dépôt (public, avec un premier commit) pour un nouveau site
  createRepo(name) {
    return this._request("/user/repos", {
      method: "POST",
      body: JSON.stringify({ name, auto_init: true, private: false }),
    });
  }

  // Crée une branche à partir d'une autre (utilisé pour la branche "pages")
  createBranch(owner, repo, newBranchName, oldBranchName) {
    return this._request(`/repos/${owner}/${repo}/branches`, {
      method: "POST",
      body: JSON.stringify({ new_branch_name: newBranchName, old_branch_name: oldBranchName }),
    });
  }

  // Webhook nécessaire pour que Codeberg Pages serve réellement la branche "pages" —
  // sans ça, la branche existe mais rien n'est publié (voir docs.codeberg.org/codeberg-pages/,
  // section Webhooks : le type de webhook doit être "forgejo", filtré sur la branche
  // "pages", avec l'URL Codeberg Pages elle-même comme cible). Nom générique
  // (`enablePublishing`) car GitHubApi n'a pas besoin de webhook pour la même chose —
  // voir github-api.js.
  enablePublishing(owner, repo) {
    return this._request(`/repos/${owner}/${repo}/hooks`, {
      method: "POST",
      body: JSON.stringify({
        type: "forgejo",
        config: { content_type: "json", url: this.pagesUrl(owner, repo) },
        events: ["push"],
        branch_filter: "pages",
        active: true,
      }),
    });
  }

  // Récupère un fichier (contenu encodé en base64 par l'API). `silent404` : ne pas logger
  // en erreur console un 404 ici (utilisé pour de simples vérifications d'existence).
  getFile(owner, repo, path, ref, { silent404 = false } = {}) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return this._request(`/repos/${owner}/${repo}/contents/${path}${query}`, { silent404 });
  }

  // Arbre complet d'une branche en un seul appel (chemin, type, sha, taille de chaque
  // entrée) — remplace le parcours dossier par dossier de walkContentFiles(). `truncated`
  // dans la réponse signale un dépôt trop gros pour tenir dans une seule page ; à vérifier
  // par l'appelant.
  listTree(owner, repo, ref) {
    return this._request(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  }

  // Contenu d'un blob par son sha (même forme `{content: base64}` que getFile, mais sans
  // passer par un chemin — utile une fois le sha connu via listTree()).
  getBlob(owner, repo, sha) {
    return this._request(`/repos/${owner}/${repo}/git/blobs/${sha}`);
  }

  // Écrit plusieurs fichiers en un seul commit — l'API Git Data de Forgejo est en
  // lecture seule (vérifié : POST /git/blobs et PATCH /git/refs renvoient 405), mais
  // l'API "contents" expose un endpoint batch dédié ("Modify multiple files",
  // POST /repos/{owner}/{repo}/contents) qui fait ce que publishFile() faisait fichier
  // par fichier, en un seul appel. Le sha des fichiers déjà présents sur la branche
  // (via listTree) distingue create/update, requis par cet endpoint.
  async publishFiles(owner, repo, branch, files) {
    const tree = await this.listTree(owner, repo, branch);
    const existingShaByPath = new Map(
      tree.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry.sha])
    );

    const fileOps = Object.entries(files).map(([path, bytes]) => {
      const sha = existingShaByPath.get(path);
      const op = { operation: sha ? "update" : "create", path, content: bytesToBase64(bytes) };
      if (sha) op.sha = sha;
      return op;
    });
    return this._request(`/repos/${owner}/${repo}/contents`, {
      method: "POST",
      body: JSON.stringify({ files: fileOps, branch, message: "Publication du site" }),
    });
  }

  // Crée ou met à jour un fichier. `sha` requis uniquement si le fichier existe déjà.
  async saveFile(owner, repo, path, content, { sha, message, branch = "main" } = {}) {
    const body = {
      content: btoa(unescape(encodeURIComponent(content))), // encode UTF-8 -> base64
      message: message || (sha ? `Mise à jour de ${path}` : `Création de ${path}`),
      branch,
    };
    if (sha) body.sha = sha;

    return this._request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: sha ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
  }

  // Conflit d'édition simultanée : Forgejo/Codeberg répondent 422 (pas 409) quand le sha
  // envoyé ne correspond plus au fichier côté serveur.
  isConflict(err) {
    return err.status === 422;
  }

  // URL publique du site une fois publié sur Codeberg Pages
  // (https://docs.codeberg.org/codeberg-pages/) : https://{owner}.codeberg.page/{repo}/,
  // sauf si le dépôt s'appelle "pages" (site racine de l'utilisateur·rice).
  pagesUrl(owner, repo) {
    const domain = CONFIG.pagesDomain || "codeberg.page";
    return repo === "pages" ? `https://${owner}.${domain}/` : `https://${owner}.${domain}/${repo}/`;
  }

  // URL du dépôt lui-même sur Codeberg (page web, pas API) — utilisé par l'écran
  // Réglages du site pour afficher un lien "Voir le dépôt".
  repoUrl(owner, repo) {
    return `${CONFIG.instanceUrl}/${owner}/${repo}`;
  }
}
