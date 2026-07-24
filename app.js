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

function slugifySiteName(raw) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function createSite() {
  const rawName = document.getElementById("newSiteName").value;
  const statusEl = document.getElementById("createSiteStatus");
  const name = slugifySiteName(rawName);

  if (!name) {
    statusEl.innerHTML = renderStatus("Choisis un nom pour ton site.", "error");
    return;
  }

  statusEl.innerHTML = renderStatus("Création du site…", "info");
  try {
    const repo = await api.createRepo(name);
    await api.createBranch(repo.owner.login, repo.name, "pages", repo.default_branch);
    await api.createPagesWebhook(repo.owner.login, repo.name);
    await api.saveFile(
      repo.owner.login,
      repo.name,
      "index.html",
      `<!DOCTYPE html>\n<html lang="fr">\n<head><meta charset="utf-8" /><title>${repo.name}</title></head>\n<body><h1>Site en construction</h1></body>\n</html>\n`,
      { branch: "pages", message: "Publication initiale" }
    );
    currentRepo = { owner: repo.owner.login, name: repo.name };
    renderEditor();
  } catch (err) {
    const message = err.status === 409 ? "Ce nom est déjà pris, choisis-en un autre." : err.message;
    statusEl.innerHTML = renderStatus(message, "error");
  }
}

async function openRepo(owner, name) {
  currentRepo = { owner, name };
  renderEditor();
}

function renderEditor(loadedPath = "content/hello.md", fileSha = null, fileContent = "") {
  appEl.innerHTML = `
    <div class="card">
      <button class="secondary" onclick="renderDashboard()">&larr; Retour aux sites</button>
      <h2 style="margin-top:16px;">${currentRepo.owner}/${currentRepo.name}</h2>
      <p style="margin-top:-8px;">
        <a href="${api.pagesUrl(currentRepo.owner, currentRepo.name)}" target="_blank" rel="noopener">
          Voir le site publié &#8599;
        </a>
      </p>

      <label for="path">Chemin du fichier (Markdown)</label>
      <input id="path" value="${loadedPath}" />

      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <button class="secondary" onclick="loadFile()">Charger ce fichier</button>
      </div>

      <label>Contenu</label>
      <div id="editorMount" style="border:1px solid var(--border); border-radius:8px; margin-bottom:16px; min-height:220px; color:#111;"></div>

      <button onclick="saveFile()">Publier</button>
      <div id="editorStatus"></div>
    </div>
  `;
  renderEditor.currentSha = fileSha;
  RichEditor.mount("editorMount", fileContent);
}

async function loadFile() {
  const path = document.getElementById("path").value.trim();
  const statusEl = document.getElementById("editorStatus");
  statusEl.innerHTML = renderStatus("Chargement…", "info");

  try {
    const file = await api.getFile(currentRepo.owner, currentRepo.name, path);
    const decoded = decodeURIComponent(escape(atob(file.content)));
    renderEditor(path, file.sha, decoded);
    document.getElementById("editorStatus").innerHTML = renderStatus(
      "Fichier chargé.",
      "success"
    );
  } catch (err) {
    // Fichier probablement inexistant -> on part sur une création
    renderEditor(path, null, "");
    document.getElementById("editorStatus").innerHTML = renderStatus(
      "Fichier introuvable, il sera créé lors de l'enregistrement.",
      "info"
    );
  }
}

async function saveFile() {
  const path = document.getElementById("path").value.trim();
  const content = await RichEditor.getMarkdown();
  const statusEl = document.getElementById("editorStatus");
  statusEl.innerHTML = renderStatus("Enregistrement…", "info");

  try {
    const result = await api.saveFile(currentRepo.owner, currentRepo.name, path, content, {
      sha: renderEditor.currentSha,
    });
    renderEditor.currentSha = result.content.sha;
    statusEl.innerHTML = renderStatus(
      "Publié avec succès sur Codeberg ✓",
      "success"
    );
  } catch (err) {
    // Forgejo/Codeberg répondent 422 (pas 409) quand le sha envoyé ne correspond plus au
    // fichier côté serveur — ça n'arrive que si on avait un sha (mise à jour, pas création).
    const message =
      renderEditor.currentSha && err.status === 422
        ? "Cette page a été modifiée entre-temps ailleurs — recharge-la (« Charger ce fichier ») avant de publier, pour ne pas écraser ce changement."
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
