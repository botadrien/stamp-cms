const appEl = document.getElementById("app");
const userbarEl = document.getElementById("userbar");
const sidebarEl = document.getElementById("sidebar");

let api = null;
let currentUser = null;
let currentRepo = null; // { owner, name }
let currentProvider = null; // entrée de GIT_PROVIDERS (voir providers.js) du fournisseur connecté

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
// { owner, repo, path, building, dirty, debounceTimer } de l'écran d'édition ouvert —
// recréé à chaque openEditor(), jamais réutilisé entre deux pages.
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
  CodeEditor.unmount();
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
      <h2>Connecte ton compte</h2>
      ${extraMessage ? renderStatus(extraMessage, "error") : ""}
      <p style="color:var(--muted); font-size:14px; line-height:1.6;">
        Ce POC se connecte directement à l'API de ton fournisseur, sans aucun serveur
        intermédiaire : le jeton d'accès reste dans ton navigateur (sessionStorage), et
        disparaît si tu fermes l'onglet.
      </p>
      <button onclick="startLogin('codeberg')">Se connecter avec Codeberg</button>
    </div>
    <div class="card">
      <h2>Se connecter avec GitLab</h2>
      <p style="color:var(--muted); font-size:14px; line-height:1.6;">
        Publication sur gitlab.com uniquement (pas d'instance GitLab auto-hébergée pour l'instant).
      </p>
      <button onclick="startLogin('gitlab')">Se connecter avec GitLab</button>
    </div>
    <div class="card">
      <h2>Se connecter avec GitHub</h2>
      <p style="color:var(--muted); font-size:14px; line-height:1.6;">
        GitHub n'autorise pas ce type de connexion en un clic depuis le navigateur seul
        (voir README) — colle plutôt un jeton d'accès personnel (scopes <code>repo</code> et
        <code>delete_repo</code>, ce dernier nécessaire pour supprimer un site depuis les réglages).
      </p>
      <a href="https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=Stamp+CMS" target="_blank" rel="noopener">
        ${ICONS.external} Créer un jeton sur GitHub
      </a>
      <label for="githubTokenInput">Jeton d'accès personnel</label>
      <input id="githubTokenInput" type="password" placeholder="ghp_..." />
      <button onclick="submitGitHubToken()">Se connecter avec GitHub</button>
      <div id="githubTokenStatus"></div>
    </div>
  `;
}

async function submitGitHubToken() {
  const input = document.getElementById("githubTokenInput");
  const statusEl = document.getElementById("githubTokenStatus");
  const token = input.value.trim();
  if (!token) {
    statusEl.innerHTML = renderStatus("Colle ton jeton d'accès personnel GitHub.", "error");
    return;
  }
  statusEl.innerHTML = renderStatus("Vérification…", "info");
  try {
    await loginWithToken("github", token);
    window.location.reload();
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
  }
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

function templatesHash(owner, name) {
  return `${siteHash(owner, name)}/templates`;
}

function templateEditorHash(owner, name, path) {
  return `${templatesHash(owner, name)}/${encodeURIComponent(path)}`;
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
  if (segments[2] === "templates" && segments[3]) {
    return { view: "template-editor", owner, repo, path: decodeURIComponent(segments[3]) };
  }
  if (segments[2] === "templates") {
    return { view: "templates", owner, repo };
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
    { key: "templates", label: "Templates", icon: ICONS.templates, href: templatesHash(owner, repo) },
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
      <a id="sidebarPublishedLink" href="${api.pagesUrl(owner, repo)}" target="_blank" rel="noopener">
        ${ICONS.external} Voir le site publié
      </a>
    </div>
  `;
}

// Une fois le domaine personnalisé connu (site.toml, voir getCustomDomain), pointe le lien
// "Voir le site publié" dessus plutôt que vers l'URL par défaut du fournisseur — appelé en
// fire-and-forget depuis renderRoute() pour ne pas retarder l'affichage de la sidebar sur
// un aller-retour réseau. Vérifie que l'utilisateur·rice n'a pas déjà navigué ailleurs
// avant que la réponse n'arrive (comparaison à currentRepo).
async function refreshSidebarPublishedLink(owner, repo) {
  let customDomain;
  try {
    customDomain = await getCustomDomain(owner, repo);
  } catch {
    return; // best-effort : le lien par défaut reste affiché en cas d'erreur
  }
  if (!customDomain) return;
  if (!currentRepo || currentRepo.owner !== owner || currentRepo.name !== repo) return;
  const link = document.getElementById("sidebarPublishedLink");
  if (link) link.href = `https://${customDomain}/`;
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
  refreshSidebarPublishedLink(route.owner, route.repo);
  if (route.view === "pages") {
    await renderPages(route.owner, route.repo);
  } else if (route.view === "posts") {
    await renderPosts(route.owner, route.repo);
  } else if (route.view === "settings") {
    await renderSiteSettings(route.owner, route.repo);
  } else if (route.view === "templates") {
    await renderTemplates(route.owner, route.repo);
  } else if (route.view === "template-editor") {
    await openTemplateEditor(route.owner, route.repo, route.path);
  } else {
    await openEditor(route.owner, route.repo, route.path);
  }
}

window.addEventListener("hashchange", renderRoute);

async function renderDashboard() {
  leaveEditor();
  userbarEl.innerHTML = `
    <span class="provider-badge" title="Connecté via ${currentProvider.label}">${currentProvider.icon()}</span>
    <span>${currentUser.login}</span>
    <button class="secondary" onclick="logout()">Déconnexion</button>
  `;

  appEl.innerHTML = `<div class="card"><p class="status info">Chargement des sites…</p></div>`;

  let repos;
  try {
    repos = (await api.listRepos()).filter((r) => (r.topics || []).includes(SITE_TOPIC));
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
    await api.enablePublishing(owner, repo.name);

    // Le thème complet est copié dans le repo du site dès sa création (plus de thème
    // central partagé lu depuis les assets de l'app à chaque build, voir le plan "Refonte
    // lecture repo") — un seul commit batch, comme la publication (api.publishFiles).
    const themeFiles = await loadThemeFiles(CURRENT_THEME);
    const encoder = new TextEncoder();
    await api.publishFiles(owner, repo.name, "main", {
      ...themeFiles,
      "content/_index.md": encoder.encode(buildIndexStub(repo.name)),
      "content/blog/_index.md": encoder.encode(buildBlogIndexStub()),
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

// Liste les gabarits .html du thème du site (voir listSiteTemplatePaths dans
// site-builder.js — toujours la liste complète, même sur un site pas encore aligné sur
// le nouveau modèle "thème copié dans le repo", voir getSiteFiles). Pas de bouton
// "Créer" : contrairement aux pages/articles, la liste des gabarits est fixée par le
// thème, on ne fait qu'éditer ceux qui existent déjà.
async function renderTemplates(owner, name) {
  leaveEditor();
  appEl.innerHTML = `
    <div class="card">
      <h2>Templates</h2>
      <p style="color:var(--muted); font-size:14px;">
        Code des gabarits du thème (HTML/Tera) — usage avancé, sans effet sur les autres
        réglages du site.
      </p>
      <div id="templatesListStatus">${renderStatus("Chargement des templates…", "info")}</div>
      <div id="templatesList"></div>
    </div>
  `;
  try {
    const paths = await listSiteTemplatePaths(owner, name);
    document.getElementById("templatesListStatus").innerHTML = "";
    document.getElementById("templatesList").innerHTML = renderTemplateList(owner, name, paths);
  } catch (err) {
    document.getElementById("templatesListStatus").innerHTML = renderStatus(err.message, "error");
  }
}

// Deux groupes : gabarits de page (rendus pour une page précise) et includes partagés
// (macros/, partials/ — réutilisés par plusieurs gabarits, donc une modification
// impacte plusieurs pages à la fois, à distinguer visuellement pour ne pas surprendre).
function renderTemplateList(owner, name, paths) {
  if (!paths.length) return renderStatus("Aucun template trouvé.", "info");

  const isShared = (p) => p.startsWith("templates/macros/") || p.startsWith("templates/partials/");
  const renderGroup = (list) =>
    list
      .map(
        (path) => `
      <div class="repo-item">
        <a href="${templateEditorHash(owner, name, path)}">${path.replace(/^templates\//, "")}</a>
      </div>`
      )
      .join("");

  const pageTemplates = paths.filter((p) => !isShared(p));
  const sharedTemplates = paths.filter(isShared);

  return `
    ${renderGroup(pageTemplates)}
    ${
      sharedTemplates.length
        ? `<h3 style="font-size:14px; color:var(--muted); margin:16px 0 4px;">Includes partagés (macros, partials)</h3>${renderGroup(sharedTemplates)}`
        : ""
    }
  `;
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
    <div class="card">
      <h2>Domaine personnalisé</h2>
      <p style="color:var(--muted); font-size:14px;">
        Sous-domaine uniquement pour l'instant (ex. <code>www.exemple.com</code>) — pas de domaine racine.
      </p>
      <label for="customDomain">Domaine</label>
      <input id="customDomain" placeholder="www.exemple.com" />
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button onclick="saveCustomDomain()">Enregistrer</button>
        <button class="secondary" onclick="checkDomainDns()">Vérifier le DNS</button>
      </div>
      <div id="customDomainStatus"></div>
      <div id="dnsCheckStatus"></div>
      <div id="dnsInstructions"></div>
    </div>
    <div class="card">
      <h2>Thème</h2>
      <div id="themeStatus">${renderStatus("Vérification…", "info")}</div>
    </div>
    <div class="card">
      <h2>Dépôt</h2>
      <p style="color:var(--muted); font-size:14px;">
        Ce site est stocké sur ${currentProvider.label}.
      </p>
      <a href="${api.repoUrl(owner, name)}" target="_blank" rel="noopener">
        ${ICONS.external} Voir le dépôt
      </a>
    </div>
    <div class="card danger-zone">
      <h2>Zone dangereuse</h2>
      <p style="color:var(--muted); font-size:14px; line-height:1.6;">
        Supprime définitivement le dépôt <strong>${owner}/${name}</strong> sur ${currentProvider.label}
        (contenu, historique, site publié). Aucune corbeille, aucun retour en arrière possible.
      </p>
      <label for="deleteSiteConfirm">Tape <code>${name}</code> pour confirmer</label>
      <input id="deleteSiteConfirm" autocomplete="off" oninput="onDeleteSiteConfirmInput()" />
      <button id="deleteSiteBtn" class="danger" disabled onclick="deleteSite()">
        Supprimer ce site
      </button>
      <div id="deleteSiteStatus"></div>
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

  try {
    const domain = await getCustomDomain(owner, name);
    document.getElementById("customDomain").value = domain || "";
    await renderDnsInstructions(owner, name, domain);
  } catch (err) {
    document.getElementById("customDomainStatus").innerHTML = renderStatus(err.message, "error");
  }

  await refreshThemeStatus(owner, name);
}

// Cible attendue de l'enregistrement CNAME selon le fournisseur connecté — même valeur
// que celle utilisée pour enregistrer/router le domaine côté fournisseur (voir
// pagesUrl()/registerCustomDomain() sur chaque client API), sans le protocole ni le slash
// final (format DNS, pas URL).
function expectedCnameTarget(providerId, owner) {
  if (providerId === "codeberg") return CONFIG.pagesDomain || "codeberg.page";
  if (providerId === "github") return `${owner}.github.io`;
  if (providerId === "gitlab") return `${owner}.gitlab.io`;
  return null;
}

// Instructions DNS propres au fournisseur connecté — texte pur, aucun appel réseau (voir
// renderDnsInstructions() ci-dessous pour la partie GitLab qui a besoin d'interroger l'API
// pour le code de vérification). Sous-domaine uniquement (voir README) : un seul
// enregistrement CNAME dans tous les cas, jamais de A/AAAA/ALIAS pour un domaine apex.
function dnsInstructionsHtml(providerId, owner, repo, domain) {
  const target = expectedCnameTarget(providerId, owner);
  const records = [`<li><code>CNAME</code> → <code>${target}</code></li>`];
  if (providerId === "codeberg") {
    records.push(
      `<li><code>TXT</code> à <code>_git-pages-repository.${domain}</code> → <code>https://codeberg.org/${owner}/${repo}.git</code> (autorisation)</li>`
    );
  }
  if (providerId === "gitlab") {
    records.push(`<li id="gitlabVerificationRecord">Enregistrement <code>TXT</code> de vérification : <em>chargement…</em></li>`);
  }
  const codebergWarning =
    providerId === "codeberg"
      ? renderStatus(
          "La publication du site sera interrompue tant que ce DNS n'est pas configuré — le webhook de publication cible désormais ce domaine.",
          "error"
        )
      : "";
  const gitlabButton =
    providerId === "gitlab" ? `<button onclick="verifyGitlabDomain()">Vérifier le domaine sur GitLab</button>` : "";

  return `
    <p style="font-size:14px; margin-top:12px;">Configuration DNS chez ton registrar pour <strong>${domain}</strong> :</p>
    <ul style="font-size:14px; line-height:1.8;">${records.join("")}</ul>
    ${codebergWarning}
    ${gitlabButton}
  `;
}

// Affiche (ou masque, si `domain` est vide) le bloc d'instructions DNS, et complète le
// code de vérification GitLab une fois connu (nécessite un appel réseau, contrairement au
// reste des instructions).
async function renderDnsInstructions(owner, repo, domain) {
  const container = document.getElementById("dnsInstructions");
  if (!domain) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = dnsInstructionsHtml(currentProvider.id, owner, repo, domain);

  if (currentProvider.id === "gitlab") {
    try {
      const status = await api.getCustomDomainStatus(owner, repo, domain);
      const recordEl = document.getElementById("gitlabVerificationRecord");
      if (recordEl) {
        recordEl.innerHTML = status
          ? `Enregistrement <code>TXT</code> → <code>gitlab-pages-verification-code=${status.verificationCode}</code> — ${
              status.verified ? "vérifié ✓" : "pas encore vérifié"
            }`
          : "Enregistrement TXT généré après le premier enregistrement du domaine";
      }
    } catch (err) {
      console.error("Échec de la récupération du statut de vérification GitLab:", err.message);
    }
  }
}

// Vérifie en direct (DNS-over-HTTPS, voir dns-check.js) si le domaine tapé pointe déjà
// vers la bonne cible pour le fournisseur connecté — utile avant même d'enregistrer, pour
// savoir si le DNS a fini de propager.
async function checkDomainDns() {
  const domain = document.getElementById("customDomain").value.trim();
  const statusEl = document.getElementById("dnsCheckStatus");
  if (!domain) {
    statusEl.innerHTML = renderStatus("Renseigne un domaine d'abord.", "error");
    return;
  }
  statusEl.innerHTML = renderStatus("Vérification du DNS…", "info");
  try {
    const ok = await checkCnameTarget(domain, expectedCnameTarget(currentProvider.id, currentRepo.owner));
    statusEl.innerHTML = ok
      ? renderStatus("Le DNS pointe bien vers la bonne cible ✓", "success")
      : renderStatus("Le DNS ne pointe pas (encore) vers la bonne cible — propagation en cours ?", "error");
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
  }
}

async function verifyGitlabDomain() {
  const domain = document.getElementById("customDomain").value.trim();
  const statusEl = document.getElementById("dnsCheckStatus");
  if (!domain) return;
  statusEl.innerHTML = renderStatus("Vérification auprès de GitLab…", "info");
  try {
    await api.verifyCustomDomain(currentRepo.owner, currentRepo.name, domain);
    statusEl.innerHTML = renderStatus("Vérifié ✓", "success");
    await renderDnsInstructions(currentRepo.owner, currentRepo.name, domain);
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
  }
}

async function saveCustomDomain() {
  const { owner, name } = currentRepo;
  const domainInput = document.getElementById("customDomain").value.trim().toLowerCase();
  const statusEl = document.getElementById("customDomainStatus");

  // Heuristique simple (pas de liste de suffixes publics) : un domaine avec un seul point
  // ressemble à un domaine racine, pas supporté pour l'instant (voir README).
  if (domainInput && domainInput.split(".").length < 3) {
    statusEl.innerHTML = renderStatus(
      "Seuls les sous-domaines sont supportés pour l'instant (ex. www.exemple.com), pas les domaines racine.",
      "error"
    );
    return;
  }
  const domain = domainInput || null;

  try {
    const previousDomain = await getCustomDomain(owner, name);

    // Pré-vol DNS uniquement pour Codeberg : repointer le webhook vers un domaine dont le
    // DNS n'a pas encore propagé casse la publication jusqu'à propagation (voir
    // ForgejoApi.registerCustomDomain) — averti explicitement avant de continuer.
    if (domain && currentProvider.id === "codeberg") {
      statusEl.innerHTML = renderStatus("Vérification du DNS…", "info");
      // Une vérification DNS ratée (service DNS-over-HTTPS injoignable, etc.) ne doit pas
      // bloquer l'enregistrement — seul un DNS positivement incorrect doit avertir.
      const ok = await checkCnameTarget(domain, expectedCnameTarget("codeberg", owner)).catch(() => false);
      if (!ok) {
        const proceed = confirm(
          `Le DNS de ${domain} ne semble pas encore pointer vers codeberg.page — la publication du site sera interrompue tant que ce ne sera pas le cas. Continuer quand même ?`
        );
        if (!proceed) {
          statusEl.innerHTML = renderStatus("Annulé — configure le DNS puis réessaie.", "info");
          return;
        }
      }
    }

    statusEl.innerHTML = renderStatus("Enregistrement…", "info");
    await setCustomDomain(owner, name, domain);

    if (currentProvider.id === "gitlab") {
      if (previousDomain && previousDomain !== domain) {
        await api.unregisterCustomDomain(owner, name, previousDomain).catch((err) => {
          console.error("Échec de la suppression de l'ancien domaine GitLab:", err.message);
        });
      }
      if (domain) {
        const existingStatus = await api.getCustomDomainStatus(owner, name, domain);
        if (!existingStatus) await api.registerCustomDomain(owner, name, domain);
      }
    } else {
      await api.registerCustomDomain(owner, name, domain);
    }

    statusEl.innerHTML = renderStatus("Génération du site…", "info");
    const { warning } = await rebuildAndPublishSite(owner, name);
    statusEl.innerHTML = warning
      ? renderStatus(warning, "error")
      : renderStatus(`Publié avec succès sur ${currentProvider.label} ✓`, "success");
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
    return;
  }

  await renderDnsInstructions(owner, name, domain);
}

// Sites créés avant que le thème complet ne soit copié dans chaque dépôt (voir
// createSite() dans app.js et getSiteFiles() dans site-builder.js) : propose une
// installation explicite plutôt que de la faire d'office.
async function refreshThemeStatus(owner, name) {
  const statusEl = document.getElementById("themeStatus");
  try {
    const hasTheme = await siteHasThemeInstalled(owner, name);
    statusEl.innerHTML = hasTheme
      ? renderStatus("Thème installé dans ce site ✓", "success")
      : `
        ${renderStatus(
          "Ce site a été créé avant que le thème ne soit copié dans chaque dépôt — il utilise encore la version partagée de l'app.",
          "info"
        )}
        <button onclick="installTheme()">Installer le thème dans ce site</button>
      `;
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
  }
}

async function installTheme() {
  const statusEl = document.getElementById("themeStatus");
  statusEl.innerHTML = renderStatus("Installation du thème…", "info");
  try {
    await installThemeInSite(currentRepo.owner, currentRepo.name);
    statusEl.innerHTML = renderStatus("Thème installé dans ce site ✓", "success");
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
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
    const { warning } = await rebuildAndPublishSite(currentRepo.owner, currentRepo.name);
    statusEl.innerHTML = warning
      ? renderStatus(warning, "error")
      : renderStatus(`Publié avec succès sur ${currentProvider.label} ✓`, "success");
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
  }
}

// N'active "Supprimer ce site" que si le nom tapé correspond exactement au nom du dépôt —
// filet de sécurité minimal pour une action irréversible (pas de corbeille côté fournisseur).
function onDeleteSiteConfirmInput() {
  const typed = document.getElementById("deleteSiteConfirm").value;
  document.getElementById("deleteSiteBtn").disabled = typed !== currentRepo.name;
}

async function deleteSite() {
  const { owner, name } = currentRepo;
  const statusEl = document.getElementById("deleteSiteStatus");
  const btn = document.getElementById("deleteSiteBtn");
  btn.disabled = true;
  statusEl.innerHTML = renderStatus("Suppression…", "info");
  try {
    await api.deleteRepo(owner, name);
    window.location.hash = "#/";
  } catch (err) {
    statusEl.innerHTML = renderStatus(err.message, "error");
    btn.disabled = false;
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

  await renderEditor(path, sha, content);
}

async function renderEditor(path, fileSha, fileContent) {
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
      <div id="previewStatus"></div>
      <iframe id="previewFrame" title="Aperçu du site"></iframe>
    </div>
  `;
  renderEditor.currentSha = fileSha;
  renderEditor.currentPath = path;

  // Le contenu du dépôt (thème + pages) vient du cache local (getRepoFiles, voir
  // repo-cache.js) — plus besoin de le pré-charger ici : buildPreviewSite() s'en charge
  // à chaque rebuild d'aperçu, et l'échec éventuel (ex. hors ligne) remonte via le
  // catch() de triggerPreviewBuild() plutôt que d'être vérifié en amont.
  // getDraft/previewTarget : voir renderTemplateEditor() pour l'équivalent côté édition de
  // gabarit — même triggerPreviewBuild() pour les deux, seul ce qui varie entre contenu et
  // template est capturé ici.
  previewState = {
    owner: currentRepo.owner,
    repo: currentRepo.name,
    path,
    previewTarget: pageUrl(path),
    getDraft: () => RichEditor.getMarkdown(),
    building: false,
    dirty: false,
    debounceTimer: null,
  };

  await RichEditor.mount("editorMount", fileContent, onEditorContentChange);
  triggerPreviewBuild();
}

// Charge le code d'un gabarit : l'override déjà enregistré dans le repo du site s'il
// existe, sinon le défaut du thème vendoré (voir getSiteFiles dans site-builder.js pour
// la même logique côté build — ici on a besoin du sha du fichier réel du repo, pas
// seulement de son contenu fusionné, donc un accès direct plutôt que getSiteFiles()).
async function openTemplateEditor(owner, name, path) {
  leaveEditor();
  appEl.innerHTML = renderStatus("Chargement…", "info");

  let sha = null;
  let code = "";
  try {
    const file = await api.getFile(owner, name, path, "main", { silent404: true });
    sha = file.sha;
    code = decodeBase64Utf8(file.content);
  } catch (err) {
    if (err.status !== 404) {
      const backHash = templatesHash(owner, name);
      appEl.innerHTML = `
        <div class="card">
          <button class="secondary" onclick='window.location.hash = ${JSON.stringify(backHash)}'>&larr; Retour aux templates</button>
          ${renderStatus(err.message, "error")}
        </div>
      `;
      return;
    }
  }

  if (sha === null) {
    try {
      const themeFiles = await loadThemeFiles(CURRENT_THEME);
      const bytes = themeFiles[path];
      if (bytes) code = new TextDecoder().decode(bytes);
    } catch {
      // Thème vendoré indisponible (ex. hors ligne) : édition depuis un fichier vide
      // plutôt que de bloquer l'écran — l'utilisateur·rice écrit son propre contenu.
    }
  }

  await renderTemplateEditor(path, sha, code);
}

async function renderTemplateEditor(path, fileSha, code) {
  const backHash = templatesHash(currentRepo.owner, currentRepo.name);
  appEl.classList.add("editor-split");
  appEl.innerHTML = `
    <div class="card editor-pane">
      <div class="editor-toolbar">
        <button class="secondary" onclick='window.location.hash = ${JSON.stringify(backHash)}'>&larr; Retour aux templates</button>
        <button onclick="saveTemplateFile()">Publier</button>
      </div>
      <div id="editorStatus"></div>
      <h2>${path}</h2>

      <label>Code du gabarit</label>
      <div id="templateEditorMount" style="margin-bottom:16px; min-height:220px;"></div>
    </div>
    <div class="card preview-pane">
      <div id="previewStatus"></div>
      <iframe id="previewFrame" title="Aperçu du site"></iframe>
    </div>
  `;
  renderTemplateEditor.currentSha = fileSha;
  renderTemplateEditor.currentPath = path;

  // previewTarget "/" (accueil), pas d'URL propre à un gabarit — le reste du mini-site
  // reste navigable depuis l'iframe (voir previewUrl()).
  previewState = {
    owner: currentRepo.owner,
    repo: currentRepo.name,
    path,
    previewTarget: "/",
    getDraft: () => CodeEditor.getCode(),
    building: false,
    dirty: false,
    debounceTimer: null,
  };

  await CodeEditor.mount("templateEditorMount", code, onEditorContentChange);
  triggerPreviewBuild();
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
    const draft = await state.getDraft();
    const { files } = await buildPreviewSite(
      state.owner,
      state.repo,
      state.path,
      draft,
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
// ne serait jamais interceptée par sw.js (vraie requête réseau, 404). `target` : URL de
// page relative au site buildé (ex. "/a-propos/", "/" — voir previewState.previewTarget),
// pas un chemin de fichier source — un gabarit n'a pas d'URL propre, voir
// renderTemplateEditor() qui pointe toujours sur "/" (le reste du mini-site reste
// navigable depuis l'iframe, tous les liens internes de l'aperçu fonctionnent).
function previewUrl(owner, repo, target) {
  const relative = `preview/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${target}`;
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
  const target = previewUrl(state.owner, state.repo, state.previewTarget);
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
    const { warning } = await rebuildAndPublishSite(currentRepo.owner, currentRepo.name);

    statusEl.innerHTML = warning
      ? renderStatus(warning, "error")
      : renderStatus(`Publié avec succès sur ${currentProvider.label} ✓`, "success");
  } catch (err) {
    // Chaque fournisseur répond différemment à un sha périmé (voir api.isConflict) — ça
    // n'arrive que si on avait un sha (mise à jour, pas création).
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
      renderEditor.currentSha && api.isConflict(err)
        ? "Cette page a été modifiée entre-temps ailleurs — retourne à la liste des pages et rouvre-la avant de publier, pour ne pas écraser ce changement."
        : err.message;
    statusEl.innerHTML = renderStatus(message, "error");
  }
}

// Miroir de saveFile() pour un gabarit : écrit directement le chemin réel dans le repo
// (templates/x.html) — plus de notion d'override séparé du défaut, voir getSiteFiles()
// dans site-builder.js (le fichier écrit ici prend simplement le pas sur le défaut du
// thème vendoré pour ce seul chemin, à la prochaine lecture).
async function saveTemplateFile() {
  const path = renderTemplateEditor.currentPath;
  const code = CodeEditor.getCode();
  const statusEl = document.getElementById("editorStatus");
  statusEl.innerHTML = renderStatus("Enregistrement…", "info");

  let codeSaved = false;
  try {
    const result = await api.saveFile(currentRepo.owner, currentRepo.name, path, code, {
      sha: renderTemplateEditor.currentSha,
    });
    renderTemplateEditor.currentSha = result.content.sha;
    codeSaved = true;

    statusEl.innerHTML = renderStatus("Génération du site…", "info");
    const { warning } = await rebuildAndPublishSite(currentRepo.owner, currentRepo.name);

    statusEl.innerHTML = warning
      ? renderStatus(warning, "error")
      : renderStatus(`Publié avec succès sur ${currentProvider.label} ✓`, "success");
  } catch (err) {
    if (codeSaved) {
      statusEl.innerHTML = renderStatus(
        `Ton template est enregistré, mais la republication du site a échoué (${err.message}). Réessaie de publier.`,
        "error"
      );
      return;
    }
    const message =
      renderTemplateEditor.currentSha && api.isConflict(err)
        ? "Ce template a été modifié entre-temps ailleurs — retourne à la liste des templates et rouvre-le avant de publier, pour ne pas écraser ce changement."
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

  currentProvider = GIT_PROVIDERS[getStoredProviderId()];
  api = new currentProvider.ApiClass(token);
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
