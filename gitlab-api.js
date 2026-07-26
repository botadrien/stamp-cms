// Petit client pour l'API GitLab (v4) — miroir de ForgejoApi (api.js) et GitHubApi
// (github-api.js), même surface de méthodes pour que app.js/site-builder.js appellent
// l'un ou l'autre sans distinction (voir providers.js pour le choix du bon client selon le
// fournisseur connecté). gitlab.com uniquement (pas de self-hosted, voir README).
// Doc : https://docs.gitlab.com/api/rest/
//
// Différences avec ForgejoApi/GitHubApi qui restent internes à cette classe (jamais
// exposées aux appelants) :
// - Les projets GitLab s'identifient par un id numérique ou par leur chemin
//   `owner/repo` URL-encodé (`owner%2Frepo`), pas par deux segments d'URL séparés comme
//   Forgejo/GitHub — voir projectId() ci-dessous.
// - listTree() est paginée côté GitLab (header `x-next-page`), contrairement à l'API Git
//   Data de Forgejo/GitHub qui renvoie tout l'arbre en un appel avec un simple flag
//   `truncated` — on boucle ici jusqu'à épuisement des pages, donc `truncated` vaut
//   toujours `false` en sortie de GitLabApi.listTree().
// - publishFiles() utilise l'API "Commits" de GitLab (POST .../repository/commits avec un
//   tableau `actions`), l'équivalent du endpoint batch "Modify multiple files" de Forgejo —
//   un seul commit pour tous les fichiers, comme Forgejo (contrairement à GitHub qui doit
//   composer blob/tree/commit/ref à la main, voir github-api.js).
// - Pas de webhook (Codeberg Pages) ni d'API Pages dédiée (GitHub Pages) : GitLab Pages
//   exige toujours un job CI pour publier quoi que ce soit (vérifié : l'API Pages de
//   GitLab, GET/PATCH/DELETE /projects/:id/pages, ne gère que les réglages et la
//   dépublication, aucun endpoint d'upload direct). enablePublishing() committe donc une
//   fois un .gitlab-ci.yml minimal dont le job ne fait *aucune compilation* — il republie
//   tel quel le contenu déjà buildé côté client sur la branche "pages", en cohérence avec
//   le principe du projet (compilation toujours dans le navigateur, jamais côté serveur).
// - listRepos()/createRepo() normalisent la réponse GitLab (qui expose `path` +
//   `namespace.path` plutôt qu'un `owner.login`/`name` direct) pour que le reste de l'appli
//   (app.js) puisse lire `repo.owner.login`/`repo.name` sans distinction de fournisseur.
// - saveFile() renvoie `{content: {sha}}` comme Forgejo/GitHub pour que app.js puisse
//   continuer à lire `result.content.sha` (voir app.js:666) — GitLab n'expose pas
//   directement ce sha dans la réponse d'écriture, donc saveFile() va le chercher avec un
//   appel de plus (voir commentaire sur saveFile ci-dessous). Le "sha" utilisé côté GitLab
//   est en réalité le `last_commit_id` de la branche, qui sert aussi de jeton de
//   verrouillage optimiste pour getFile()/saveFile() (voir isConflict()).
class GitLabApi {
  static providerId = "gitlab";
  static providerLabel = "GitLab";

  constructor(token) {
    this.token = token;
    this.base = "https://gitlab.com/api/v4";
  }

  // GitLab identifie un projet par son chemin `owner/repo` URL-encodé dans le chemin de
  // l'URL (ex. /projects/owner%2Frepo) — un seul niveau d'encodage, PAS un double encodage
  // malgré ce que suggèrerait la présence d'un `/` encodé au milieu d'un segment d'URL.
  projectId(owner, repo) {
    return encodeURIComponent(`${owner}/${repo}`);
  }

  async _fetch(path, options = {}) {
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
      throw new Error(`Impossible de contacter ${GitLabApi.providerLabel} — vérifie ta connexion et réessaie.`);
    }

    if (!response.ok) {
      if (!(response.status === 404 && options.silent404)) {
        console.error(`API error (${response.status}) sur ${path}:`, await response.text());
      }
      const err = new Error(friendlyApiError(response.status, GitLabApi.providerLabel));
      err.status = response.status;
      throw err;
    }
    return response;
  }

  async _request(path, options = {}) {
    const response = await this._fetch(path, options);
    if (response.status === 204) return null;
    return response.json();
  }

  getCurrentUser() {
    return this._request("/user");
  }

  // Dépôts accessibles par l'utilisateur connecté. Normalise `path`/`namespace.path` (forme
  // GitLab) en `name`/`owner.login` (forme Forgejo/GitHub) pour que le reste de l'appli
  // n'ait pas à distinguer le fournisseur — voir commentaire de tête de fichier.
  async listRepos() {
    const projects = await this._request("/projects?membership=true&per_page=50&order_by=last_activity_at");
    return projects.map((p) => this._normalizeProject(p));
  }

  // Crée un nouveau dépôt (public, avec un premier commit) pour un nouveau site
  async createRepo(name) {
    const project = await this._request("/projects", {
      method: "POST",
      body: JSON.stringify({ name, initialize_with_readme: true, visibility: "public" }),
    });
    return this._normalizeProject(project);
  }

  // GitLab expose `path`/`namespace.path`/`path_with_namespace` là où Forgejo/GitHub
  // exposent directement `name`/`owner.login`/`full_name` — app.js lit ces trois derniers
  // champs sans distinguer le fournisseur (voir app.js:290, `r.full_name`), d'où cette
  // normalisation systématique sur chaque objet projet renvoyé par l'API.
  _normalizeProject(project) {
    return {
      ...project,
      name: project.path,
      owner: { login: project.namespace.path },
      full_name: project.path_with_namespace,
    };
  }

  // Crée une branche à partir d'une autre (utilisé pour la branche "pages") — un seul
  // appel, comme Forgejo (contrairement à GitHub).
  createBranch(owner, repo, newBranchName, oldBranchName) {
    const params = new URLSearchParams({ branch: newBranchName, ref: oldBranchName });
    return this._request(`/projects/${this.projectId(owner, repo)}/repository/branches?${params}`, {
      method: "POST",
    });
  }

  // Committe un .gitlab-ci.yml minimal — nécessaire pour que GitLab Pages serve la branche
  // "pages" (voir commentaire de tête de fichier : pas d'API de déploiement direct côté
  // GitLab, contrairement à Codeberg/GitHub). Le job ne compile rien : `rsync` republie tel
  // quel le contenu déjà buildé côté client et présent sur la branche "pages" — à valider
  // en pratique contre une vraie instance GitLab (voir e2e/, plan d'implémentation).
  async enablePublishing(owner, repo) {
    // Les nouveaux projets gitlab.com ont "Use unique domain" activé par défaut : le site
    // n'est alors servi qu'à une URL du type https://{repo}-{hash}.gitlab.io/ (hash imprévisible
    // côté client), et l'URL "classique" https://{owner}.gitlab.io/{repo}/ (celle que renvoie
    // pagesUrl() ci-dessous) redirige dessus — redirection qui casse les sous-requêtes
    // d'assets (CSS/JS), pas seulement la navigation HTML (confirmé en pratique : la
    // redirection passe par projects.gitlab.io/auth, qu'un <link>/<script> ne peut pas
    // suivre). On désactive donc ce réglage à la création du site pour que pagesUrl() reste
    // exacte. Endpoint en multipart/form-data (pas JSON), contrairement au reste de l'API —
    // vérifié contre la doc GitLab, voir docs.gitlab.com/api/pages/.
    await this._disableUniqueDomain(owner, repo);

    const ciConfig = `pages:
  stage: deploy
  image: alpine:3
  rules:
    - if: '$CI_COMMIT_BRANCH == "pages"'
  script:
    - apk add --no-cache rsync
    - mkdir -p public
    - rsync -a --exclude=public --exclude=.gitlab-ci.yml --exclude=.git ./ public/
  artifacts:
    paths:
      - public
`;
    return this.saveFile(owner, repo, ".gitlab-ci.yml", ciConfig, {
      branch: "pages",
      message: "Active GitLab Pages (publication du contenu déjà compilé, sans build CI)",
    });
  }

  async _disableUniqueDomain(owner, repo) {
    const formData = new FormData();
    formData.append("pages_unique_domain_enabled", "false");
    let response;
    try {
      response = await fetch(`${this.base}/projects/${this.projectId(owner, repo)}/pages`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${this.token}` },
        body: formData,
      });
    } catch (networkErr) {
      console.error("Network error sur /pages:", networkErr);
      throw new Error(`Impossible de contacter ${GitLabApi.providerLabel} — vérifie ta connexion et réessaie.`);
    }
    if (!response.ok) {
      console.error(`API error (${response.status}) sur /pages:`, await response.text());
      const err = new Error(friendlyApiError(response.status, GitLabApi.providerLabel));
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  // Récupère un fichier (contenu encodé en base64 par l'API). `silent404` : ne pas logger
  // en erreur console un 404 ici (utilisé pour de simples vérifications d'existence).
  // `sha` est ici un alias de `last_commit_id` (voir commentaire de tête de fichier), à
  // repasser à saveFile() pour la détection de conflit optimiste.
  async getFile(owner, repo, path, ref, { silent404 = false } = {}) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const file = await this._request(
      `/projects/${this.projectId(owner, repo)}/repository/files/${encodeURIComponent(path)}${query}`,
      { silent404 }
    );
    return { ...file, sha: file.last_commit_id };
  }

  // Arbre complet d'une branche — paginé côté GitLab (contrairement à Forgejo/GitHub),
  // on boucle jusqu'à ce que `x-next-page` soit vide. `truncated` toujours `false` en
  // sortie : la boucle épuise toutes les pages, il n'y a donc jamais de coupure partielle.
  async listTree(owner, repo, ref) {
    const entries = [];
    let page = 1;
    while (page) {
      const params = new URLSearchParams({
        ref,
        recursive: "true",
        per_page: "100",
        page: String(page),
      });
      const response = await this._fetch(
        `/projects/${this.projectId(owner, repo)}/repository/tree?${params}`
      );
      entries.push(...(await response.json()));
      page = Number(response.headers.get("x-next-page")) || null;
    }
    return {
      truncated: false,
      tree: entries.map((entry) => ({ path: entry.path, type: entry.type, sha: entry.id })),
    };
  }

  // Contenu d'un blob par son sha (même forme `{content: base64}` que getFile).
  getBlob(owner, repo, sha) {
    return this._request(`/projects/${this.projectId(owner, repo)}/repository/blobs/${sha}`);
  }

  // Sha du commit HEAD d'une branche — vérification légère utilisée par repo-cache.js
  // pour savoir si la copie locale (IndexedDB) est encore à jour, sans retélécharger
  // tout le dépôt.
  async getHeadSha(owner, repo, branch) {
    const info = await this._request(`/projects/${this.projectId(owner, repo)}/repository/branches/${encodeURIComponent(branch)}`);
    return info.commit.id;
  }

  // Archive complète d'une branche en un seul appel (thème + contenu, voir
  // docs/plan-lecture-content-batch.md et tar-utils.js) — remplace listTree + N×getBlob,
  // et notamment la pagination interne de listTree() ci-dessus. CORS ouvert vérifié en
  // direct sur cet endpoint. Passe par _fetch (pas _request) : la réponse est un binaire
  // (tar.gz), pas du JSON.
  async fetchRepoArchive(owner, repo, ref) {
    const params = new URLSearchParams({ sha: ref });
    // cache: "no-store" — voir le commentaire équivalent sur ForgejoApi.fetchRepoArchive
    // (api.js) : cette URL ne varie pas avec le commit, un cache HTTP navigateur non
    // désactivé pourrait resservir une archive périmée après une écriture rapprochée.
    const response = await this._fetch(
      `/projects/${this.projectId(owner, repo)}/repository/archive.tar.gz?${params}`,
      { cache: "no-store" }
    );
    return parseTarGz(await response.arrayBuffer());
  }

  // Écrit plusieurs fichiers en un seul commit via l'API "Commits" de GitLab (`actions`) —
  // équivalent du endpoint batch "Modify multiple files" de Forgejo. Le chemin déjà présent
  // sur la branche (via listTree) distingue create/update, comme pour Forgejo.
  async publishFiles(owner, repo, branch, files) {
    const tree = await this.listTree(owner, repo, branch);
    const existingPaths = new Set(tree.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path));

    const actions = Object.entries(files).map(([path, bytes]) => ({
      action: existingPaths.has(path) ? "update" : "create",
      file_path: path,
      content: bytesToBase64(bytes),
      encoding: "base64",
    }));

    return this._request(`/projects/${this.projectId(owner, repo)}/repository/commits`, {
      method: "POST",
      body: JSON.stringify({ branch, commit_message: "Publication du site", actions }),
    });
  }

  // Diagnostic best-effort après publication : contrairement à Forgejo/GitHub, GitLab exige
  // toujours un pipeline CI pour publier (voir enablePublishing()) — ce pipeline peut rester
  // bloqué indéfiniment en attente d'un runner si le compte gitlab.com n'a pas encore été
  // vérifié pour les minutes CI gratuites (vérification identité/carte, déclenchée côté
  // GitLab de façon opaque). Aucun champ d'API ne permet de détecter ce blocage à l'avance
  // (voir échange avec l'utilisateur) — on ne peut que constater après coup que le dernier
  // pipeline reste "coincé" dans un état pré-exécution après quelques tentatives, et le
  // signaler. Retourne `null` si rien d'anormal à signaler (pipeline pas encore créé, ou
  // déjà en train de tourner / terminé).
  async checkPublishHealth(owner, repo, branch = "pages") {
    const STUCK_STATUSES = new Set(["created", "pending", "waiting_for_resource", "preparing", "scheduled"]);
    const POLL_INTERVAL_MS = 3000;
    const MAX_ATTEMPTS = 5; // ~15s au total avant d'avertir plutôt que de bloquer l'UI indéfiniment

    let latestStatus = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const params = new URLSearchParams({ ref: branch, per_page: "1", order_by: "id", sort: "desc" });
      const pipelines = await this._request(`/projects/${this.projectId(owner, repo)}/pipelines?${params}`);
      if (!pipelines[0]) return null;

      latestStatus = pipelines[0].status;
      if (!STUCK_STATUSES.has(latestStatus)) return null;

      if (attempt < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    return `Le pipeline GitLab reste bloqué ("${latestStatus}", pas de runner disponible) — vérifie que ton compte est habilité pour les runners partagés (souvent une vérification d'identité à faire une fois sur un compte gitlab.com récent, voir Settings > CI/CD > Runners), sinon le site publié ne se mettra jamais à jour.`;
  }

  // Crée ou met à jour un fichier. `sha`, si présent, est passé en `last_commit_id` pour
  // activer la détection de conflit optimiste de GitLab (voir isConflict()) — absent à la
  // création, comme pour Forgejo/GitHub.
  // La réponse d'écriture de GitLab (`{file_path, branch}`) ne contient pas le nouveau
  // sha/commit — contrairement à Forgejo/GitHub, on va donc chercher le HEAD actuel de la
  // branche juste après (le commit qu'on vient de créer, sauf écriture concurrente entre
  // les deux appels) pour renvoyer `{content: {sha}}` comme les deux autres clients
  // (voir app.js:666, qui lit `result.content.sha` sans distinguer le fournisseur).
  async saveFile(owner, repo, path, content, { sha, message, branch = "main" } = {}) {
    const body = {
      branch,
      content: bytesToBase64FromString(content),
      encoding: "base64",
      commit_message: message || (sha ? `Mise à jour de ${path}` : `Création de ${path}`),
    };
    if (sha) body.last_commit_id = sha;

    await this._request(
      `/projects/${this.projectId(owner, repo)}/repository/files/${encodeURIComponent(path)}`,
      { method: sha ? "PUT" : "POST", body: JSON.stringify(body) }
    );

    const branchInfo = await this._request(`/projects/${this.projectId(owner, repo)}/repository/branches/${encodeURIComponent(branch)}`);
    return { content: { sha: branchInfo.commit.id } };
  }

  // Conflit d'édition simultanée : GitLab répond 400 quand `last_commit_id` ne correspond
  // plus au HEAD de la branche (verrouillage optimiste, voir saveFile()). Contrairement à
  // Forgejo (422) et GitHub (409), GitLab ne réserve pas de code HTTP dédié à ce cas
  // précis — un 400 peut aussi venir d'une requête mal formée. On se limite donc au cas où
  // on avait bien fourni un sha (update, pas create) : à confirmer/affiner contre une
  // vraie instance GitLab (voir e2e/).
  isConflict(err) {
    return err.status === 400;
  }

  // URL publique du site une fois publié sur GitLab Pages :
  // https://{owner}.gitlab.io/{repo}/. Valable pour un namespace utilisateur/groupe de
  // premier niveau ; les sous-groupes (namespaces imbriqués) sont hors périmètre MVP,
  // cohérent avec le modèle owner/repo actuel de l'appli.
  pagesUrl(owner, repo) {
    return `https://${owner}.gitlab.io/${repo}/`;
  }

  // URL du dépôt lui-même sur GitLab (page web, pas API).
  repoUrl(owner, repo) {
    return `https://gitlab.com/${owner}/${repo}`;
  }

  // Supprime le projet entier — irréversible (GitLab passe par une mise en corbeille
  // temporisée côté serveur selon le plan, mais rien de piloté depuis cette app).
  deleteRepo(owner, repo) {
    return this._request(`/projects/${this.projectId(owner, repo)}`, { method: "DELETE" });
  }
}

// GitLab attend le contenu en base64 quand `encoding: "base64"` est précisé — même
// contrainte UTF-8 -> base64 que Forgejo/GitHub (voir bytesToBase64 dans api.js, réservé
// aux Uint8Array), mais saveFile() reçoit ici une chaîne JS, pas des bytes.
function bytesToBase64FromString(content) {
  return btoa(unescape(encodeURIComponent(content)));
}
