const appEl = document.getElementById("app");
const userbarEl = document.getElementById("userbar");

let api = null;
let currentUser = null;
let currentRepo = null; // { owner, name }

function renderStatus(message, type = "info") {
  return `<p class="status ${type}">${message}</p>`;
}

function renderLogin(extraMessage = "") {
  RichEditor.unmount();
  userbarEl.innerHTML = "";
  appEl.innerHTML = `
    <div class="card">
      <h2>Connecte ton compte Codeberg</h2>
      <p style="color:var(--muted); font-size:14px; line-height:1.6;">
        Ce POC se connecte directement à l'API Codeberg via OAuth2 + PKCE.
        Aucun serveur intermédiaire : le jeton d'accès reste dans ton navigateur
        (sessionStorage), et disparaît si tu fermes l'onglet.
      </p>
      ${extraMessage ? renderStatus(extraMessage, "error") : ""}
      <button onclick="startLogin()">Se connecter avec Codeberg</button>
    </div>
  `;
}

function renderLoading(message) {
  appEl.innerHTML = renderStatus(message, "info");
}

async function renderDashboard() {
  RichEditor.unmount();
  userbarEl.innerHTML = `
    <span>${currentUser.login}</span>
    <button class="secondary" onclick="logout()">Déconnexion</button>
  `;

  appEl.innerHTML = `<div class="card"><p class="status info">Chargement des sites…</p></div>`;

  let repos;
  try {
    repos = await api.listRepos();
  } catch (err) {
    if (err.status === 401) {
      sessionStorage.clear();
      renderLogin(err.message);
      return;
    }
    appEl.innerHTML = `<div class="card">${renderStatus(err.message, "error")}</div>`;
    return;
  }

  const repoItems = repos
    .map(
      (r) => `
      <div class="repo-item">
        <div>
          <div>${r.full_name}</div>
          <span>${r.private ? "privé" : "public"} · branche par défaut : ${r.default_branch}</span>
        </div>
        <button class="secondary" onclick='openRepo(${JSON.stringify(r.owner.login)}, ${JSON.stringify(r.name)})'>
          Ouvrir
        </button>
      </div>`
    )
    .join("");

  appEl.innerHTML = `
    <div class="card">
      <h2>Tes sites</h2>
      ${repos.length ? repoItems : renderStatus("Aucun site trouvé sur ce compte.", "info")}
    </div>
    <div class="card">
      <h2>Créer un site</h2>
      <label for="newSiteName">Nom du site</label>
      <input id="newSiteName" placeholder="mon-site" />
      <button onclick="createSite()">Créer</button>
      <div id="createSiteStatus"></div>
    </div>
  `;
}

async function createSite() {
  const rawName = document.getElementById("newSiteName").value;
  const statusEl = document.getElementById("createSiteStatus");
  const name = slugify(rawName);

  if (!name) {
    statusEl.innerHTML = renderStatus("Choisis un nom pour ton site.", "error");
    return;
  }

  statusEl.innerHTML = renderStatus("Création du site…", "info");
  try {
    const repo = await api.createRepo(name);
    const owner = repo.owner.login;
    await api.createBranch(owner, repo.name, "pages", repo.default_branch);
    await api.createPagesWebhook(owner, repo.name);

    const scaffold = zolaScaffold(repo.name, api.pagesUrl(owner, repo.name));
    for (const [path, content] of Object.entries(scaffold)) {
      await api.saveFile(owner, repo.name, path, content, { message: "Site initial" });
    }

    statusEl.innerHTML = renderStatus("Génération du site…", "info");
    await rebuildAndPublishSite(owner, repo.name);

    currentRepo = { owner, name: repo.name };
    renderSitePages(owner, repo.name);
  } catch (err) {
    const message = err.status === 409 ? "Ce nom est déjà pris, choisis-en un autre." : err.message;
    statusEl.innerHTML = renderStatus(message, "error");
  }
}

async function openRepo(owner, name) {
  currentRepo = { owner, name };
  renderSitePages(owner, name);
}

async function renderSitePages(owner, name) {
  RichEditor.unmount();
  appEl.innerHTML = `
    <div class="card">
      <button class="secondary" onclick="renderDashboard()">&larr; Retour aux sites</button>
      <h2 style="margin-top:16px;">${owner}/${name}</h2>
      <p style="margin-top:-8px;">
        <a href="${api.pagesUrl(owner, name)}" target="_blank" rel="noopener">
          Voir le site publié &#8599;
        </a>
      </p>
      <div id="pagesListStatus">${renderStatus("Chargement des pages…", "info")}</div>
      <div id="pagesList"></div>
    </div>
    <div class="card">
      <h2>Ajouter une page</h2>
      <label for="newPageTitle">Titre de la page</label>
      <input id="newPageTitle" placeholder="À propos" />
      <button onclick="addPage()">Créer</button>
      <div id="addPageStatus"></div>
    </div>
  `;

  try {
    const pages = await listContentPages(owner, name);
    renderSitePages.pages = pages;
    document.getElementById("pagesListStatus").innerHTML = "";
    document.getElementById("pagesList").innerHTML = pages
      .map(
        (p) => `
      <div class="repo-item">
        <div>${p.title}</div>
        <button class="secondary" onclick='editPage(${JSON.stringify(p.path)})'>Modifier</button>
      </div>`
      )
      .join("");
  } catch (err) {
    renderSitePages.pages = [];
    document.getElementById("pagesListStatus").innerHTML = renderStatus(err.message, "error");
  }
}

function addPage() {
  const title = document.getElementById("newPageTitle").value.trim();
  const statusEl = document.getElementById("addPageStatus");
  if (!title) {
    statusEl.innerHTML = renderStatus("Choisis un titre pour la page.", "error");
    return;
  }
  const existingPaths = (renderSitePages.pages || []).map((p) => p.path);
  const path = nextAvailablePagePath(title, existingPaths);
  renderEditor(path, null, "");
}

async function editPage(path) {
  RichEditor.unmount();
  const owner = currentRepo.owner;
  const name = currentRepo.name;
  appEl.innerHTML = renderStatus("Chargement…", "info");
  try {
    const file = await api.getFile(owner, name, path, "main");
    const decoded = stripFrontMatter(decodeBase64Utf8(file.content));
    renderEditor(path, file.sha, decoded);
  } catch (err) {
    renderSitePages(owner, name);
  }
}

function renderEditor(path, fileSha, fileContent) {
  appEl.innerHTML = `
    <div class="card">
      <button class="secondary" onclick="renderSitePages(currentRepo.owner, currentRepo.name)">&larr; Retour aux pages</button>
      <h2 style="margin-top:16px;">${currentRepo.owner}/${currentRepo.name}</h2>

      <label>Contenu</label>
      <div id="editorMount" style="border:1px solid var(--border); border-radius:8px; margin-bottom:16px; min-height:220px; color:#111;"></div>

      <button onclick="saveFile()">Publier</button>
      <div id="editorStatus"></div>
    </div>
  `;
  renderEditor.currentSha = fileSha;
  renderEditor.currentPath = path;
  RichEditor.mount("editorMount", fileContent);
}

async function saveFile() {
  const path = renderEditor.currentPath;
  const content = ensureFrontMatter(await RichEditor.getMarkdown(), path);
  const statusEl = document.getElementById("editorStatus");
  statusEl.innerHTML = renderStatus("Enregistrement…", "info");

  let markdownSaved = false;
  try {
    const result = await api.saveFile(currentRepo.owner, currentRepo.name, path, content, {
      sha: renderEditor.currentSha,
    });
    renderEditor.currentSha = result.content.sha;
    markdownSaved = true;

    statusEl.innerHTML = renderStatus("Génération du site…", "info");
    await rebuildAndPublishSite(currentRepo.owner, currentRepo.name);

    statusEl.innerHTML = renderStatus("Publié avec succès sur Codeberg ✓", "success");
  } catch (err) {
    // Forgejo/Codeberg répondent 422 (pas 409) quand le sha envoyé ne correspond plus au
    // fichier côté serveur — ça n'arrive que si on avait un sha (mise à jour, pas création).
    if (markdownSaved) {
      // Le contenu est bien enregistré (source de vérité) ; seule la republication du
      // site a échoué — ne pas laisser croire que la page elle-même n'est pas publiée.
      statusEl.innerHTML = renderStatus(
        `Ta page est enregistrée, mais la republication du site a échoué (${err.message}). Réessaie de publier.`,
        "error"
      );
      return;
    }
    const message =
      renderEditor.currentSha && err.status === 422
        ? "Cette page a été modifiée entre-temps ailleurs — retourne à la liste des pages et rouvre-la avant de publier, pour ne pas écraser ce changement."
        : err.message;
    statusEl.innerHTML = renderStatus(message, "error");
  }
}

async function init() {
  renderLoading("Vérification de la session…");

  try {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      // Ex. "a grant exists with different scope" si l'appli a été autorisée avant
      // avec un scope différent (revoke-la sur Codeberg dans Settings > Applications).
      window.history.replaceState({}, document.title, window.location.pathname);
      renderLogin(`La connexion a été refusée par Codeberg (${oauthError}).`);
      return;
    }
    if (params.get("code")) {
      renderLoading("Connexion en cours…");
      await handleRedirectCallback();
    }
  } catch (err) {
    renderLogin(err.message);
    return;
  }

  const token = getStoredToken();
  if (!token) {
    renderLogin();
    return;
  }

  api = new ForgejoApi(token);
  try {
    currentUser = await api.getCurrentUser();
  } catch (err) {
    // Token invalide ou expiré
    sessionStorage.clear();
    renderLogin("Session expirée, reconnecte-toi.");
    return;
  }

  renderDashboard();
}

init();
