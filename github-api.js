// Petit client pour l'API GitHub — miroir de ForgejoApi (api.js), même surface de
// méthodes pour que app.js/site-builder.js appellent l'un ou l'autre sans distinction
// (voir providers.js pour le choix du bon client selon le fournisseur connecté).
// Doc : https://docs.github.com/en/rest
//
// Différences avec ForgejoApi qui restent internes à cette classe (jamais exposées aux
// appelants) :
// - createBranch() : GitHub n'a pas d'endpoint "créer une branche" en un seul appel comme
//   Gitea/Forgejo — il faut lire le sha de la branche de base puis créer une ref.
// - saveFile()/saveFileBytes() : l'API "contents" de GitHub utilise toujours PUT (création
//   et mise à jour), alors que Forgejo distingue POST (création) / PUT (mise à jour).
// - enablePublishing() : pas de webhook, un appel dédié à l'API Pages.
// - pagesUrl()/repoUrl() : formes d'URL propres à GitHub.
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

  // Liste le contenu d'un dossier dans un dépôt (racine par défaut). 404 si le dossier
  // n'existe pas encore (site tout juste créé, pas encore de page à part l'accueil).
  listContents(owner, repo, path = "", ref) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return this._request(`/repos/${owner}/${repo}/contents/${path}${query}`);
  }

  // Récupère un fichier (contenu encodé en base64 par l'API). `silent404` : ne pas logger
  // en erreur console un 404 ici (utilisé pour de simples vérifications d'existence).
  getFile(owner, repo, path, ref, { silent404 = false } = {}) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return this._request(`/repos/${owner}/${repo}/contents/${path}${query}`, { silent404 });
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

  // Comme saveFile(), mais pour des octets bruts (Uint8Array) plutôt qu'une chaîne — sortie
  // du build Zola, qui mélange HTML/CSS générés et assets binaires (polices, icônes)
  // recopiés tels quels. bytesToBase64 est défini dans api.js (chargé avant ce fichier).
  async saveFileBytes(owner, repo, path, bytes, { sha, message, branch = "main" } = {}) {
    const body = {
      content: bytesToBase64(bytes),
      message: message || (sha ? `Mise à jour de ${path}` : `Création de ${path}`),
      branch,
    };
    if (sha) body.sha = sha;

    return this._request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
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
}
