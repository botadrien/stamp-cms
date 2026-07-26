const appEl = document.getElementById("app");
const userbarEl = document.getElementById("userbar");
const sidebarEl = document.getElementById("sidebar");

let api = null;
let currentUser = null;
let currentRepo = null; // { owner, name }

// L'attribut data-theme est déjà posé au plus tôt par le script inline dans <head> (avant
// même que ce fichier ne charge, pour éviter un flash) — ici on ne fait qu'aligner l'icône
// du bouton dessus, et prévenir l'éditeur riche (île React séparée, voir editor.jsx) au cas
// où il serait monté au moment du bascule.
function applyThemeToggleIcon() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
  btn.title = isDark ? "Passer en mode clair" : "Passer en mode sombre";
}

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem("cms-theme", next);
  document.documentElement.setAttribute("data-theme", next);
  applyThemeToggleIcon();
  window.dispatchEvent(new Event("cms-theme-change"));
}

applyThemeToggleIcon();

// Aperçu en direct de l'éditeur — voir sw.js (service worker qui sert /preview/...) et
// buildPreviewSite() dans site-builder.js. swReady résout une fois le worker actif,
// avant quoi pointer un iframe vers /preview/... ferait une vraie requête réseau (404).
let swReady = null;
// { owner, repo, path, contentFiles, building, dirty, debounceTimer } de l'écran
// d'édition ouvert — recréé à chaque openEditor(), jamais réutilisé entre deux pages.
let previewState = null;

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    swReady = Promise.resolve(null);
    return;
  }
  swReady = navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready) // { active, ... } une fois installé+activé
    .catch(() => null);
}

// Le worker actif (registration.active), pas navigator.serviceWorker.controller : ce
// dernier ne reflète que si le document *courant* est contrôlé, ce qui ne se met à jour
// qu'après coup (clients.claim()) — alors qu'une *nouvelle* navigation (notre iframe) vers
// une URL dans le scope du worker passe par lui dès qu'il est actif, sans lien avec le
// statut de contrôle du document parent.
async function getPreviewWorker() {
  const registration = await swReady;
  return registration ? registration.active : null;
}

// postMessage() revient avant que le worker ait traité le message — attendre l'accusé de
// réception (voir sw.js) avant de naviguer l'iframe, sinon la requête /preview/... peut
// arriver avant que le worker ait fini de mettre sa map à jour.
function sendToPreviewWorker(worker, message) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    worker.postMessage(message, [channel.port2]);
  });
}

function renderStatus(message, type = "info") {
  return `<p class="status ${type}">${message}</p>`;
}

// Quitte l'écran d'édition proprement : démonte l'éditeur riche et coupe tout aperçu en
// cours/à venir (timer de débounce, build en vol dont le résultat serait jeté de toute
// façon via le garde previewState !== state dans triggerPreviewBuild()).
function leaveEditor() {
  RichEditor.unmount();
  if (previewState) clearTimeout(previewState.debounceTimer);
  previewState = null;
}

function renderLogin(extraMessage = "") {
  leaveEditor();
  appEl.classList.remove("editor-split");
  userbarEl.innerHTML = "";
  sidebarEl.hidden = true;
  sidebarEl.innerHTML = "";
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

// Écrans adressés par l'URL (#/, #/owner/repo, #/owner/repo/edit/chemin) plutôt que par
// de simples appels de fonction : chaque navigation interne (openRepo, editPage, boutons
// "Retour"...) passe par window.location.hash = ..., ce qui pousse une entrée d'historique
// navigateur. Sans ça, le bouton "Précédent" du navigateur retombe directement sur les
// pages du flow OAuth (login/consentement Codeberg) qui précèdent le premier écran de
// l'appli, puisque les changements d'écran ne touchaient jamais l'historique.
function siteHash(owner, name) {
  return `#/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

function postsHash(owner, name) {
  return `${siteHash(owner, name)}/posts`;
}

function editorHash(owner, name, path) {
  return `${siteHash(owner, name)}/edit/${encodeURIComponent(path)}`;
}

function settingsHash(owner, name) {
  return `${siteHash(owner, name)}/settings`;
}

function parseHash(hash) {
  const clean = (hash || "").replace(/^#\/?/, "");
  if (!clean) return { view: "dashboard" };
  const segments = clean.split("/");
  const owner = decodeURIComponent(segments[0] || "");
  const repo = decodeURIComponent(segments[1] || "");
  if (!owner || !repo) return { view: "dashboard" };
  if (segments[2] === "edit" && segments[3]) {
    return { view: "editor", owner, repo, path: decodeURIComponent(segments[3]) };
  }
  if (segments[2] === "settings") {
    return { view: "settings", owner, repo };
  }
  if (segments[2] === "posts") {
    return { view: "posts", owner, repo };
  }
  // Rien après owner/repo : "Pages" est l'écran d'accueil d'un site (pas de segment
  // d'URL dédié), pour que les liens/retours existants vers #/owner/repo continuent de
  // fonctionner tels quels.
  return { view: "pages", owner, repo };
}

// Barre latérale façon WordPress (Pages / Articles / Réglages), affichée dès qu'on est
// "dans" un site — masquée sur le tableau de bord et l'écran de connexion. Re-rendue en
// entier à chaque navigation plutôt que montée une fois et mise à jour : cohérent avec le
// reste du fichier (chaque écran fait un innerHTML complet), et évite tout risque de
// surbrillance d'item périmée pour un coût négligeable (quelques <a>).
function renderSidebar(route) {
  if (!route) {
    sidebarEl.hidden = true;
    sidebarEl.innerHTML = "";
    return;
  }
  const { owner, repo, view } = route;
  const items = [
    { key: "pages", label: "Pages", icon: ICONS.pages, href: siteHash(owner, repo) },
    { key: "posts", label: "Articles", icon: ICONS.posts, href: postsHash(owner, repo) },
    { key: "settings", label: "Réglages", icon: ICONS.settings, href: settingsHash(owner, repo) },
  ];
  sidebarEl.hidden = false;
  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <a class="sidebar-back" href="#/">${ICONS.back} Tes sites</a>
      <div class="sidebar-site-name">${owner}/${repo}</div>
    </div>
    <ul class="sidebar-nav">
      ${items
        .map(
          (item) => `
        <li>
          <a class="sidebar-nav-item ${view === item.key ? "active" : ""}" href="${item.href}">
            ${item.icon}<span>${item.label}</span>
          </a>
        </li>`
        )
        .join("")}
    </ul>
    <div class="sidebar-footer">
      <a href="${api.pagesUrl(owner, repo)}" target="_blank" rel="noopener">
        ${ICONS.external} Voir le site publié
      </a>
    </div>
  `;
}

// Traduit l'URL courante en écran affiché — appelé au chargement (pour permettre de
// recharger la page sur un site/une page précis·e) et à chaque "hashchange" (navigation
// interne, ou bouton Précédent/Suivant du navigateur).
async function renderRoute() {
  if (!api) return; // pas encore authentifié, rien à router pour l'instant
  appEl.classList.remove("editor-split"); // remis par renderEditor() si besoin
  const route = parseHash(window.location.hash);
  if (route.view === "dashboard") {
    currentRepo = null;
    renderSidebar(null);
    await renderDashboard();
    return;
  }
  currentRepo = { owner: route.owner, name: route.repo };
  renderSidebar(route);
  if (route.view === "pages") {
    await renderPages(route.owner, route.repo);
  } else if (route.view === "posts") {
    await renderPosts(route.owner, route.repo);
  } else if (route.view === "settings") {
    await renderSiteSettings(route.owner, route.repo);
  } else {
    await openEditor(route.owner, route.repo, route.path);
  }
}

window.addEventListener("hashchange", renderRoute);

async function renderDashboard() {
  leaveEditor();
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

    await api.saveFile(owner, repo.name, "content/_index.md", buildIndexStub(repo.name), {
      message: "Site initial",
    });
    await api.saveFile(owner, repo.name, "content/blog/_index.md", buildBlogIndexStub(), {
      message: "Site initial",
    });

    statusEl.innerHTML = renderStatus("Génération du site…", "info");
    await rebuildAndPublishSite(owner, repo.name);

    window.location.hash = siteHash(owner, repo.name);
  } catch (err) {
    const message = err.status === 409 ? "Ce nom est déjà pris, choisis-en un autre." : err.message;
    statusEl.innerHTML = renderStatus(message, "error");
  }
}

function openRepo(owner, name) {
  window.location.hash = siteHash(owner, name);
}

function renderPageList(entries, emptyMessage) {
  if (!entries.length) return renderStatus(emptyMessage, "info");
  return entries
    .map(
      (p) => `
    <div class="repo-item">
      <a href="#" onclick='editPage(${JSON.stringify(p.path)}); return false;'>${p.title}</a>
    </div>`
    )
    .join("");
}

// Commun à renderPages()/renderPosts() : une seule lecture de listContentPages() (qui
// renvoie déjà pages ET articles), filtrée selon l'écran. Le cache complet (pas filtré)
// est réutilisé par addPage() pour éviter qu'une page standalone et un article de blog
// se retrouvent sur le même slug.
async function loadAndRenderList(owner, name, type, listElId, statusElId, emptyMessage) {
  try {
    const pages = await listContentPages(owner, name);
    loadAndRenderList.pages = pages;
    document.getElementById(statusElId).innerHTML = "";
    document.getElementById(listElId).innerHTML = renderPageList(
      pages.filter((p) => p.type === type),
      emptyMessage
    );
  } catch (err) {
    loadAndRenderList.pages = [];
    document.getElementById(statusElId).innerHTML = renderStatus(err.message, "error");
  }
}

async function renderPages(owner, name) {
  leaveEditor();
  appEl.innerHTML = `
    <div class="card">
      <h2>Pages</h2>
      <div id="pagesListStatus">${renderStatus("Chargement des pages…", "info")}</div>
      <div id="pagesList"></div>
    </div>
    <div class="card">
      <h2>Ajouter une page</h2>
      <label for="newPageTitle">Titre de la page</label>
      <input id="newPageTitle" placeholder="À propos" />
      <button onclick="addPage('page')">Créer</button>
      <div id="addPageStatus"></div>
    </div>
  `;
  await loadAndRenderList(owner, name, "page", "pagesList", "pagesListStatus", "Aucune page pour l'instant.");
}

async function renderPosts(owner, name) {
  leaveEditor();
  appEl.innerHTML = `
    <div class="card">
      <h2>Articles</h2>
      <div id="postsListStatus">${renderStatus("Chargement des articles…", "info")}</div>
      <div id="postsList"></div>
    </div>
    <div class="card">
      <h2>Ajouter un article</h2>
      <label for="newPostTitle">Titre de l'article</label>
      <input id="newPostTitle" placeholder="Mon premier article" />
      <button onclick="addPage('post')">Créer</button>
      <div id="addPostStatus"></div>
    </div>
  `;
  await loadAndRenderList(owner, name, "post", "postsList", "postsListStatus", "Aucun article pour l'instant.");
}

// kind: "page" (standalone, content/) ou "post" (article de blog, content/blog/).
function addPage(kind) {
  const inputId = kind === "post" ? "newPostTitle" : "newPageTitle";
  const statusId = kind === "post" ? "addPostStatus" : "addPageStatus";
  const dirPrefix = kind === "post" ? "content/blog/" : "content/";

  const title = document.getElementById(inputId).value.trim();
  const statusEl = document.getElementById(statusId);
  if (!title) {
    statusEl.innerHTML = renderStatus("Choisis un titre.", "error");
    return;
  }
  const existingPaths = (loadAndRenderList.pages || []).map((p) => p.path);
  const path = nextAvailablePagePath(title, existingPaths, dirPrefix);
  window.location.hash = editorHash(currentRepo.owner, currentRepo.name, path);
}

function editPage(path) {
  window.location.hash = editorHash(currentRepo.owner, currentRepo.name, path);
}

async function renderSiteSettings(owner, name) {
  leaveEditor();
  appEl.innerHTML = `
    <div class="card">
      <h2>Réglages du site</h2>
      <div id="settingsLoadStatus">${renderStatus("Chargement…", "info")}</div>
      <div id="settingsForm" style="display:none;">
        <label for="blogTitle">Titre du blog</label>
        <input id="blogTitle" />
        <button onclick="saveBlogTitle()">Enregistrer</button>
        <div id="settingsStatus"></div>
      </div>
    </div>
  `;

  try {
    const title = await getBlogTitle(owner, name);
    document.getElementById("settingsLoadStatus").innerHTML = "";
    document.getElementById("settingsForm").style.display = "";
    document.getElementById("blogTitle").value = title;
  } catch (err) {
    document.getElementById("settingsLoadStatus").innerHTML = renderStatus(err.message, "error");
  }
}

async function saveBlogTitle() {
  const title = document.getElementById("blogTitle").value.trim();
  const statusEl = document.getElementById("settingsStatus");
  if (!title) {
    statusEl.innerHTML = renderStatus("Choisis un titre.", "error");
    return;
  }

  statusEl.innerHTML = renderStatus("Enregistrement…", "info");
  try {
    await setBlogTitle(currentRepo.owner, currentRepo.name, title);
    statusEl.innerHTML = renderStatus("Génération du site…", "info");
    await rebuildAndPublishSite(currentRepo.owner, currentRepo.name);
    statusEl.innerHTML = renderStatus("Publié avec succès sur Codeberg ✓", "success");
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
  }
}

// Charge une page existante, ou prépare un éditeur vide si elle n'existe pas encore (cas
// d'une page tout juste ajoutée via "Ajouter une page", pas encore publiée donc pas
// encore sur main — un 404 ici est normal, pas une vraie erreur).
async function openEditor(owner, name, path) {
  leaveEditor();
  appEl.innerHTML = renderStatus("Chargement…", "info");

  let sha = null;
  let content = "";
  try {
    const file = await api.getFile(owner, name, path, "main", { silent404: true });
    sha = file.sha;
    content = stripFrontMatter(decodeBase64Utf8(file.content));
  } catch (err) {
    if (err.status !== 404) {
      const backHash = siteHash(owner, name);
      appEl.innerHTML = `
        <div class="card">
          <button class="secondary" onclick='window.location.hash = ${JSON.stringify(backHash)}'>&larr; Retour aux pages</button>
          ${renderStatus(err.message, "error")}
        </div>
      `;
      return;
    }
  }

  // Contenu des autres pages, chargé une seule fois par passage sur l'écran d'édition —
  // réutilisé par chaque rebuild d'aperçu (pas de nouvel appel réseau par frappe). Si ça
  // échoue, l'édition reste possible ; seul l'aperçu sera indisponible.
  let contentFiles = {};
  try {
    contentFiles = await fetchContentFiles(owner, name);
  } catch (err) {
    contentFiles = null;
  }

  await renderEditor(path, sha, content, contentFiles);
}

async function renderEditor(path, fileSha, fileContent, contentFiles) {
  const backHash = siteHash(currentRepo.owner, currentRepo.name);
  appEl.classList.add("editor-split");
  appEl.innerHTML = `
    <div class="card editor-pane">
      <div class="editor-toolbar">
        <button class="secondary" onclick='window.location.hash = ${JSON.stringify(backHash)}'>&larr; Retour aux pages</button>
        <button onclick="saveFile()">Publier</button>
      </div>
      <div id="editorStatus"></div>
      <h2>${currentRepo.owner}/${currentRepo.name}</h2>

      <label>Contenu</label>
      <div id="editorMount" style="margin-bottom:16px; min-height:220px;"></div>
    </div>
    <div class="card preview-pane">
      <div id="previewStatus">${contentFiles ? "" : renderStatus("Aperçu indisponible.", "error")}</div>
      <iframe id="previewFrame" title="Aperçu du site"></iframe>
    </div>
  `;
  renderEditor.currentSha = fileSha;
  renderEditor.currentPath = path;

  previewState = contentFiles && {
    owner: currentRepo.owner,
    repo: currentRepo.name,
    path,
    contentFiles,
    building: false,
    dirty: false,
    debounceTimer: null,
  };

  await RichEditor.mount("editorMount", fileContent, onEditorContentChange);
  if (previewState) triggerPreviewBuild();
}

// Débounce : une frappe redémarre le délai plutôt que de builder à chaque caractère —
// un rebuild complet du site prend ~11-15s (voir AGENTS.md), pas question de l'appeler
// en continu pendant la frappe.
function onEditorContentChange() {
  if (!previewState) return;
  previewState.dirty = true;
  clearTimeout(previewState.debounceTimer);
  previewState.debounceTimer = setTimeout(triggerPreviewBuild, 1800);
}

async function triggerPreviewBuild() {
  const state = previewState;
  if (!state || state.building) {
    if (state) state.dirty = true;
    return;
  }
  // Un build qui démarre annule tout timer de débounce en attente (ex. le rattrapage
  // "dirty" lancé depuis finally ci-dessous, avant même que le timer programmé par
  // onEditorContentChange() n'ait eu le temps de se déclencher) — sinon ce timer
  // redéclenche un rebuild redondant (déjà à jour) juste après, qui recharge l'iframe
  // une 3e fois pour rien (flicker observé en e2e : le clic sur un lien de nav pouvait
  // tomber pile pendant ce rechargement de trop et échouer).
  clearTimeout(state.debounceTimer);
  state.dirty = false;
  state.building = true;

  const statusEl = document.getElementById("previewStatus");
  if (statusEl) statusEl.innerHTML = renderStatus("Génération de l'aperçu…", "info");

  try {
    const draftMarkdown = await RichEditor.getMarkdown();
    const { files } = await buildPreviewSite(
      state.owner,
      state.repo,
      state.path,
      draftMarkdown,
      state.contentFiles,
      previewBaseUrl(state.owner, state.repo)
    );
    if (previewState !== state) return; // écran quitté entre-temps

    const worker = await getPreviewWorker();
    if (worker) {
      await sendToPreviewWorker(worker, { type: "update-preview", owner: state.owner, repo: state.repo, files });
      reloadPreviewFrame(state);
      if (statusEl) statusEl.innerHTML = "";
    } else if (statusEl) {
      statusEl.innerHTML = renderStatus("Aperçu indisponible (service worker non supporté).", "error");
    }
  } catch (err) {
    if (previewState === state && statusEl) {
      statusEl.innerHTML = renderStatus(`Aperçu indisponible : ${err.message}`, "error");
    }
  } finally {
    if (previewState === state) {
      state.building = false;
      if (state.dirty) triggerPreviewBuild();
    }
  }
}

// Relatif à l'URL de la page (pas "/preview/..." en dur) : l'appli peut être déployée
// sous un sous-chemin (voir config.js), et le scope du service worker ne couvre que son
// propre répertoire — une URL absolue à la racine du domaine échapperait à ce scope et
// ne serait jamais interceptée par sw.js (vraie requête réseau, 404).
function previewUrl(owner, repo, path) {
  const relative = `preview/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${pageUrl(path)}`;
  return new URL(relative, document.baseURI).href;
}

// base_url passée à Zola pour un build d'aperçu (voir buildPreviewSite() dans
// site-builder.js) : sans ça, Zola génère nav/liens/assets en absolu vers le vrai domaine
// de prod (api.pagesUrl), qui n'a pas encore ce contenu et n'est de toute façon pas dans
// le scope intercepté par sw.js — la nav et les assets casseraient dans l'aperçu.
function previewBaseUrl(owner, repo) {
  const relative = `preview/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/`;
  return new URL(relative, document.baseURI).href;
}

function reloadPreviewFrame(state) {
  const frame = document.getElementById("previewFrame");
  if (!frame) return;
  const target = previewUrl(state.owner, state.repo, state.path);
  if (frame.src === target) {
    frame.contentWindow.location.reload();
  } else {
    frame.src = target;
  }
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
  registerServiceWorker();
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

  // Respecte l'URL courante (utile en cas de rechargement au milieu de l'appli) plutôt
  // que de toujours retomber sur le tableau de bord.
  await renderRoute();
}

init();
