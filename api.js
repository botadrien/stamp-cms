// Petit client pour l'API Forgejo (compatible Codeberg).
// Doc : https://codeberg.org/api/swagger

// Messages non-techniques par défaut selon le code HTTP — jamais de JSON/stack trace
// brut affiché à l'utilisateur·rice (voir docs/objective.md, section "Gestion des
// erreurs"). Les cas qui ont besoin de plus de contexte (ex. conflit d'édition, nom de
// site déjà pris) sont affinés au niveau des appelants via `err.status`.
function friendlyApiError(status) {
  if (status === 401) return "Ta session a expiré, reconnecte-toi.";
  if (status === 403) return "Tu n'as pas les droits nécessaires pour cette action.";
  if (status === 404) return "Introuvable — ça a peut-être été supprimé ou déplacé.";
  if (status === 409) return "Ce contenu a changé entre-temps ailleurs.";
  if (status === 422) return "Cette action n'est pas possible telle quelle.";
  if (status >= 500) return "Codeberg rencontre un problème de son côté, réessaie dans un instant.";
  return "Une erreur est survenue, réessaie.";
}

class ForgejoApi {
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
      throw new Error("Impossible de contacter Codeberg — vérifie ta connexion et réessaie.");
    }

    if (!response.ok) {
      console.error(`API error (${response.status}) sur ${path}:`, await response.text());
      const err = new Error(friendlyApiError(response.status));
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

  // Liste le contenu d'un dossier dans un dépôt (racine par défaut)
  listContents(owner, repo, path = "") {
    return this._request(`/repos/${owner}/${repo}/contents/${path}`);
  }

  // Récupère un fichier (contenu encodé en base64 par l'API)
  getFile(owner, repo, path) {
    return this._request(`/repos/${owner}/${repo}/contents/${path}`);
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

  // URL publique du site une fois publié sur Codeberg Pages
  // (https://docs.codeberg.org/codeberg-pages/) : https://{owner}.codeberg.page/{repo}/,
  // sauf si le dépôt s'appelle "pages" (site racine de l'utilisateur·rice).
  pagesUrl(owner, repo) {
    const domain = CONFIG.pagesDomain || "codeberg.page";
    return repo === "pages" ? `https://${owner}.${domain}/` : `https://${owner}.${domain}/${repo}/`;
  }
}
