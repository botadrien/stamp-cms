// Petit client pour l'API Forgejo (compatible Codeberg).
// Doc : https://codeberg.org/api/swagger

class ForgejoApi {
  constructor(token) {
    this.token = token;
    this.base = `${CONFIG.instanceUrl}/api/v1`;
  }

  async _request(path, options = {}) {
    const response = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error (${response.status}) sur ${path} : ${errText}`);
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

  // Liste le contenu d'un dossier dans un dépôt (racine par défaut)
  listContents(owner, repo, path = "") {
    return this._request(`/repos/${owner}/${repo}/contents/${path}`);
  }

  // Récupère un fichier (contenu encodé en base64 par l'API)
  getFile(owner, repo, path) {
    return this._request(`/repos/${owner}/${repo}/contents/${path}`);
  }

  // Crée ou met à jour un fichier markdown. `sha` requis uniquement si le fichier existe déjà.
  async saveFile(owner, repo, path, markdownContent, { sha, message } = {}) {
    const body = {
      content: btoa(unescape(encodeURIComponent(markdownContent))), // encode UTF-8 -> base64
      message: message || (sha ? `Mise à jour de ${path}` : `Création de ${path}`),
      branch: "main",
    };
    if (sha) body.sha = sha;

    return this._request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: sha ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
  }
}
