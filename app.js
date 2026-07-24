const appEl = document.getElementById("app");
const userbarEl = document.getElementById("userbar");

let api = null;
let currentUser = null;
let currentRepo = null; // { owner, name }

function renderStatus(message, type = "info") {
  return `<p class="status ${type}">${message}</p>`;
}

function renderLogin(extraMessage = "") {
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
  userbarEl.innerHTML = `
    <span>${currentUser.login}</span>
    <button class="secondary" onclick="logout()">Déconnexion</button>
  `;

  appEl.innerHTML = `<div class="card"><p class="status info">Chargement des dépôts…</p></div>`;

  let repos;
  try {
    repos = await api.listRepos();
  } catch (err) {
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
      <h2>Tes dépôts</h2>
      ${repos.length ? repoItems : renderStatus("Aucun dépôt trouvé sur ce compte.", "info")}
    </div>
  `;
}

async function openRepo(owner, name) {
  currentRepo = { owner, name };
  renderEditor();
}

function renderEditor(loadedPath = "content/hello.md", fileSha = null, fileContent = "") {
  appEl.innerHTML = `
    <div class="card">
      <button class="secondary" onclick="renderDashboard()">&larr; Retour aux dépôts</button>
      <h2 style="margin-top:16px;">${currentRepo.owner}/${currentRepo.name}</h2>

      <label for="path">Chemin du fichier (Markdown)</label>
      <input id="path" value="${loadedPath}" />

      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <button class="secondary" onclick="loadFile()">Charger ce fichier</button>
      </div>

      <label for="content">Contenu</label>
      <textarea id="content" placeholder="# Titre de la page&#10;&#10;Écris ton contenu en markdown ici...">${fileContent}</textarea>

      <button onclick="saveFile()">Enregistrer (commit)</button>
      <div id="editorStatus"></div>
    </div>
  `;
  renderEditor.currentSha = fileSha;
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
  const content = document.getElementById("content").value;
  const statusEl = document.getElementById("editorStatus");
  statusEl.innerHTML = renderStatus("Enregistrement…", "info");

  try {
    await api.saveFile(currentRepo.owner, currentRepo.name, path, content, {
      sha: renderEditor.currentSha,
    });
    statusEl.innerHTML = renderStatus(
      "Commit effectué avec succès sur Codeberg ✓",
      "success"
    );
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
  }
}

async function init() {
  renderLoading("Vérification de la session…");

  try {
    const codeInUrl = new URLSearchParams(window.location.search).get("code");
    if (codeInUrl) {
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
