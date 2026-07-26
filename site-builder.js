// Orchestration du "vrai" site statique (Zola, via ZolaBuilder — voir
// editor-src/zola-builder.js) : thème vendoré (themes/<nom>/, voir CURRENT_THEME
// ci-dessous) + config.toml généré dynamiquement + contenu Markdown récupéré sur la
// branche main, buildé en mémoire, publié sur la branche pages. Utilisé à la fois à la
// création du site et à chaque "Publier".

// Thème codé en dur pour l'instant (voir README.md, section "Génération du site") —
// point d'accroche pour un choix de thème plus tard : il suffira de faire varier cette
// valeur (et de vendorer d'autres thèmes sous themes/<nom>/, voir
// scripts/fetch-theme-volks-typo.sh pour le modèle).
const CURRENT_THEME = "volks-typo";

let cachedThemeFiles = null;

// Récupère tous les fichiers d'un thème vendoré (themes/<nom>/manifest.json + chaque
// fichier qu'il liste) en Uint8Array — texte et binaire (polices, icônes) traités pareil,
// Zola recopie les assets statiques tels quels de toute façon. Mis en cache en mémoire :
// le thème ne change pas d'une publication à l'autre dans une session.
async function loadThemeFiles(themeName) {
  if (cachedThemeFiles) return cachedThemeFiles;

  const manifestRes = await fetch(`themes/${themeName}/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`Thème "${themeName}" introuvable.`);
  }
  const paths = await manifestRes.json();

  const files = {};
  await Promise.all(
    paths.map(async (relPath) => {
      const res = await fetch(`themes/${themeName}/${relPath}`);
      if (!res.ok) {
        throw new Error(`Fichier de thème manquant : ${relPath}`);
      }
      files[relPath] = new Uint8Array(await res.arrayBuffer());
    })
  );

  cachedThemeFiles = files;
  return files;
}

function escapeToml(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// URL Zola d'une page à partir de son chemin content/ (content/a-propos.md -> /a-propos/).
function pageUrl(path) {
  return "/" + path.replace(/^content\//, "").replace(/\.md$/, "") + "/";
}

// config.toml régénéré à chaque publication — jamais préservé/édité à la main. `title`
// vient du front matter de content/_index.md (seul réglage éditable pour l'instant, voir
// getBlogTitle/setBlogTitle), `standalonePages` sert à construire le menu de nav
// (identique sur toutes les pages, voir templates/partials/header.html du thème).
function buildConfigToml({ title, baseUrl, standalonePages }) {
  const menuItems = [
    { name: "Accueil", url: "/" },
    ...standalonePages.map((p) => ({ name: p.title, url: pageUrl(p.path) })),
    { name: "Blog", url: "/blog/" },
  ];
  const mainMenuToml = menuItems
    .map((item) => `  { name = "${escapeToml(item.name)}", url = "${escapeToml(item.url)}" },`)
    .join("\n");

  return `title = "${escapeToml(title)}"
base_url = "${escapeToml(baseUrl)}"
# Thème vendoré en CSS précompilé (static/main.css, voir
# scripts/fetch-theme-volks-typo.sh) — plus de sass/ à compiler, ça évite de repayer ce
# coût à chaque build (publication et surtout chaque aperçu live).
compile_sass = false
feed_filename = "rss.xml"

taxonomies = [
  { name = "categories" },
  { name = "tags" },
]

[markdown.highlighting]
theme = "nord"

[extra]
# Pas encore éditable depuis le CMS (voir écran "Réglages du site" pour le titre du
# blog, le seul réglage exposé pour l'instant).
author_name = "Auteur du site"
list_images = true
# footer.html boucle dessus sans le protéger d'un {% if %} — doit toujours être défini,
# même vide (pas encore de réglage réseaux sociaux dans le CMS).
social_links = []
main_menu = [
${mainMenuToml}
]
`;
}

// content/_index.md : front matter seul, plus de corps Markdown — la page d'accueil
// n'est plus éditée via l'éditeur riche (voir templates/index.html du thème, réécrit
// pour ce CMS). Le titre est le seul réglage éditable de l'accueil pour l'instant.
function buildIndexStub(title) {
  // Pas de sort_by="date" ici (contrairement à la section blog) : les pages standalone
  // n'ont pas de date, Zola les exclurait silencieusement de section.pages sous un tri
  // par date ("ignored: missing date... in a sorted section").
  return `+++
title = "${escapeToml(title)}"
template = "index.html"
+++
`;
}

// content/blog/_index.md : section blog, structurelle (pas encore éditable depuis le CMS).
function buildBlogIndexStub() {
  return `+++
title = "Blog"
sort_by = "date"
template = "blog.html"
page_template = "page.html"
paginate_by = 10
generate_feed = true
+++
`;
}

function decodeBase64Utf8(base64) {
  return decodeURIComponent(escape(atob(base64)));
}

function titleFromPath(path) {
  const base = path.split("/").pop().replace(/\.md$/, "");
  const words = base.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Zola refuse tout fichier content/*.md sans front matter ("+++"/"---" en tête) — notre
// éditeur riche n'en écrit pas. On l'ajoute automatiquement si absent, de façon invisible
// pour l'utilisateur·rice (titre déduit du premier titre tapé, sinon du nom de fichier).
// Un article de blog (content/blog/...) reçoit une date ; une page standalone reçoit le
// gabarit générique du thème (voir themes/volks-typo/templates/standalone-page.html).
function ensureFrontMatter(markdown, path) {
  if (/^(\+\+\+|---)\s*$/m.test(markdown.split("\n", 1)[0])) return markdown;
  const heading = markdown.match(/^#\s+(.+)$/m);
  const title = (heading ? heading[1] : titleFromPath(path)).replace(/"/g, '\\"');
  if (path.startsWith("content/blog/")) {
    const date = new Date().toISOString().slice(0, 10);
    return `+++\ntitle = "${title}"\ndate = ${date}\n+++\n\n${markdown}`;
  }
  return `+++\ntitle = "${title}"\ntemplate = "standalone-page.html"\n+++\n\n${markdown}`;
}

// Retire le front matter avant de charger le contenu dans l'éditeur riche — ce n'est pas
// à l'utilisateur·rice de voir/éditer ce bloc TOML, ensureFrontMatter() le régénère à la
// publication.
function stripFrontMatter(markdown) {
  const match = markdown.match(/^(\+\+\+|---)\r?\n[\s\S]*?\r?\n\1\s*\r?\n?/);
  return match ? markdown.slice(match[0].length) : markdown;
}

function encodeUtf8Base64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// Repo (via le cache local, voir getRepoFiles dans repo-cache.js) fusionné par-dessus le
// thème vendoré de l'app — fusion fichier par fichier (pas un tout-ou-rien sur "le thème
// est-il installé") : un site créé avant cette fonctionnalité, ou n'ayant personnalisé
// qu'UN SEUL gabarit, retombe correctement sur le thème vendoré pour tout le reste plutôt
// que de se retrouver avec un site cassé (macros/partials manquants). Le thème vendoré
// étant caché en mémoire après le premier appel (voir loadThemeFiles), cette fusion est
// quasi gratuite. installThemeInSite() ci-dessous copie explicitement tout le thème dans
// le repo, à la demande (voir renderSiteSettings dans app.js) — jamais requis pour que la
// lecture/le build fonctionnent, seulement pour rendre le repo autonome. Point d'entrée à
// utiliser partout dans ce fichier à la place de getRepoFiles() directement.
async function getSiteFiles(owner, repo) {
  const [themeFiles, repoFiles] = await Promise.all([loadThemeFiles(CURRENT_THEME), getRepoFiles(owner, repo, api)]);
  return { ...themeFiles, ...repoFiles };
}

// Vrai si ce site a déjà son thème copié dans son repo — pour l'écran Réglages, qui
// propose installThemeInSite() sinon. Repo réel (pas getSiteFiles, qui masquerait
// l'absence via le repli sur le thème vendoré).
async function siteHasThemeInstalled(owner, repo) {
  const repoFiles = await getRepoFiles(owner, repo, api);
  return Object.keys(repoFiles).some((path) => path.startsWith("templates/"));
}

// Installe le thème complet dans un site créé avant cette fonctionnalité (voir
// getSiteFiles ci-dessus) — même commit batch que createSite() dans app.js, sur main.
// Idempotent : un site qui a déjà templates/ n'a rien à gagner à le refaire, mais rien de
// cassé non plus (publishFiles écraserait juste les mêmes fichiers avec le même contenu).
async function installThemeInSite(owner, repo) {
  const themeFiles = await loadThemeFiles(CURRENT_THEME);
  await api.publishFiles(owner, repo, "main", themeFiles);
  await invalidateRepoCache(owner, repo);
}

// Récupère tout le contenu de content/ sur main et retourne { "content/x.md": "...", ... }
// — décodé depuis le cache local de tout le dépôt (voir repo-cache.js ; getRepoFiles ne
// retélécharge que si le sha HEAD distant a changé depuis le dernier appel). Utilisé pour
// le *build* — inclut les _index.md (sections), contrairement à listContentPages() qui
// les exclut de la liste "pages" éditable.
async function fetchContentFiles(owner, repo) {
  const repoFiles = await getSiteFiles(owner, repo);
  const files = {};
  for (const [path, bytes] of Object.entries(repoFiles)) {
    if (!path.startsWith("content/") || !path.endsWith(".md")) continue;
    // Garantit un front matter même sur des pages créées avant que ça soit automatique
    // (ou modifiées hors du CMS) — Zola refuse de builder le site entier si UN SEUL
    // fichier content/*.md en est dépourvu.
    files[path] = ensureFrontMatter(new TextDecoder().decode(bytes), path);
  }
  return files;
}

// Titre lisible d'une page : celui du front matter TOML si présent, sinon déduit du nom
// de fichier (voir titleFromPath).
function extractTitle(markdown, path) {
  const match = markdown.match(/^title\s*=\s*"(.*)"\s*$/m);
  return match ? match[1].replace(/\\"/g, '"') : titleFromPath(path);
}

// Liste les pages/articles existants (chemin + titre + type) pour l'écran "pages du
// site" — exclut les _index.md (structurels : accueil et section blog, pas des pages
// éditables via l'éditeur riche). Réutilise fetchContentFiles() (donc le même cache
// local) plutôt qu'un parcours séparé.
async function listContentPages(owner, repo) {
  const contentFiles = await fetchContentFiles(owner, repo);
  const pages = Object.entries(contentFiles)
    .filter(([path]) => !path.endsWith("_index.md"))
    .map(([path, markdown]) => ({
      path,
      title: extractTitle(markdown, path),
      type: path.startsWith("content/blog/") ? "post" : "page",
    }));
  pages.sort((a, b) => a.title.localeCompare(b.title));
  return pages;
}

// Chemins .html sous templates/ (gabarits de page + includes partagés macros/partials,
// voir renderTemplates() dans app.js) pour peupler l'onglet Templates — dérivés de
// getSiteFiles(), donc toujours la liste complète même sur un site pas encore aligné sur
// le nouveau modèle "thème copié dans le repo" (voir le commentaire de getSiteFiles).
async function listSiteTemplatePaths(owner, repo) {
  const files = await getSiteFiles(owner, repo);
  return Object.keys(files)
    .filter((path) => path.startsWith("templates/") && path.endsWith(".html"))
    .sort();
}

// Transforme un texte libre en identifiant de fichier/dépôt (minuscules, sans accents,
// tirets). Utilisé à la fois pour le nom de dépôt à la création d'un site et pour le
// chemin de fichier d'une nouvelle page/article.
function slugify(raw) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Choisit un chemin <dirPrefix><slug>.md libre pour une nouvelle page/article, en
// suffixant -2, -3... si le titre saisi donne un slug déjà utilisé. dirPrefix distingue
// page standalone ("content/") et article de blog ("content/blog/").
function nextAvailablePagePath(title, existingPaths, dirPrefix = "content/") {
  const base = slugify(title) || "page";
  let path = `${dirPrefix}${base}.md`;
  let n = 2;
  while (existingPaths.includes(path)) {
    path = `${dirPrefix}${base}-${n}.md`;
    n += 1;
  }
  return path;
}

// Titre actuel du blog (front matter de content/_index.md), pour pré-remplir l'écran
// "Réglages du site". Nom du dépôt par défaut si le fichier n'existe pas encore.
async function getBlogTitle(owner, repo) {
  try {
    const file = await api.getFile(owner, repo, "content/_index.md", "main");
    return extractTitle(decodeBase64Utf8(file.content), "content/_index.md");
  } catch (err) {
    if (err.status === 404) return repo;
    throw err;
  }
}

async function setBlogTitle(owner, repo, title) {
  let sha = null;
  try {
    const existing = await api.getFile(owner, repo, "content/_index.md", "main", { silent404: true });
    sha = existing.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  await api.saveFile(owner, repo, "content/_index.md", buildIndexStub(title), {
    sha,
    message: "Mise à jour du titre du blog",
  });
}

// Construit le site en mémoire (contenu du repo + config générée) sans rien publier —
// utilisé à la fois par rebuildAndPublishSite() et par buildPreviewSite() ci-dessous, qui
// ne diffèrent qu'après cet appel (l'un publie sur pages, l'autre sert direct via le
// service worker de preview). `repoFiles` : { chemin: Uint8Array } tel que renvoyé par
// getRepoFiles() (repo-cache.js) — thème + content/, tel quel sur la branche main du site
// (voir le plan "Refonte lecture repo" : le thème n'est plus lu séparément depuis les
// assets de l'app à chaque build, seulement une fois à la création du site).
// `drafts` : { chemin: "texte" } — un brouillon en cours d'édition, pas encore enregistré
// sur main, qui doit prendre le pas sur le contenu du repo pour cette preview ; chemin
// content/*.md (page/article) ou templates/*.html (gabarit), même mécanique pour les deux.
// baseUrl doit être absolue (Zola l'exige) : l'URL réelle du site publié pour
// rebuildAndPublishSite(), l'URL /preview/<owner>/<repo>/ pour buildPreviewSite() — sinon
// Zola génère nav/assets/liens en absolu vers le vrai domaine de prod (qui n'a pas encore
// ce contenu), hors du scope intercepté par sw.js.
async function buildSiteFiles(owner, repo, repoFiles, baseUrl, drafts = {}) {
  const contentPaths = new Set(Object.keys(repoFiles).filter((p) => p.startsWith("content/") && p.endsWith(".md")));
  for (const path of Object.keys(drafts)) {
    if (path.startsWith("content/") && path.endsWith(".md")) contentPaths.add(path);
  }

  const contentText = {};
  for (const path of contentPaths) {
    const raw = path in drafts ? drafts[path] : new TextDecoder().decode(repoFiles[path]);
    contentText[path] = ensureFrontMatter(raw, path);
  }

  const title = contentText["content/_index.md"]
    ? extractTitle(contentText["content/_index.md"], "content/_index.md")
    : repo;
  const standalonePages = Object.keys(contentText)
    .filter((path) => !path.endsWith("_index.md") && !path.startsWith("content/blog/"))
    .map((path) => ({ path, title: extractTitle(contentText[path], path) }));

  const encoder = new TextEncoder();
  const encodedContent = {};
  for (const [path, text] of Object.entries(contentText)) {
    encodedContent[path] = encoder.encode(text);
  }
  const nonContentDrafts = {};
  for (const [path, text] of Object.entries(drafts)) {
    if (!contentPaths.has(path)) nonContentDrafts[path] = encoder.encode(text);
  }

  const files = {
    ...repoFiles,
    ...nonContentDrafts,
    "config.toml": buildConfigToml({ title, baseUrl, standalonePages }),
    ...encodedContent,
  };
  if (!files["content/_index.md"]) files["content/_index.md"] = encoder.encode(buildIndexStub(repo));
  if (!files["content/blog/_index.md"]) files["content/blog/_index.md"] = encoder.encode(buildBlogIndexStub());

  return ZolaBuilder.buildSite(files);
}

// Rebuild d'aperçu : récupère le repo (servi depuis le cache local si déjà à jour, voir
// getRepoFiles) et y substitue le brouillon en cours d'édition, non encore enregistré —
// une page/un article (content/*.md) ou un gabarit de thème (templates/*.html), même
// fonction pour les deux. Ne publie rien : la sortie est servie directement par sw.js.
// previewBaseUrl : voir previewBaseUrl() dans app.js — même chemin que celui utilisé pour
// naviguer l'iframe.
async function buildPreviewSite(owner, repo, draftPath, draftText, previewBaseUrl) {
  const repoFiles = await getSiteFiles(owner, repo);
  try {
    return await buildSiteFiles(owner, repo, repoFiles, previewBaseUrl, { [draftPath]: draftText });
  } catch (err) {
    console.error("Échec du build Zola (aperçu):", err.log || err.message);
    throw err;
  }
}

// Récupère tout le dépôt (thème + contenu, depuis le cache local ou fraîchement
// téléchargé si le sha distant a changé — voir getRepoFiles), buildit avec Zola (en
// mémoire, dans le navigateur), et publie tous les fichiers produits sur la branche
// pages en un seul commit (voir api.publishFiles — un batch côté Forgejo, une séquence
// blob/tree/commit/ref via l'API Git Data côté GitHub, plutôt qu'un aller-retour
// get-sha+PUT séquentiel par fichier).
async function rebuildAndPublishSite(owner, repo) {
  const repoFiles = await getSiteFiles(owner, repo);

  let output;
  try {
    ({ files: output } = await buildSiteFiles(owner, repo, repoFiles, api.pagesUrl(owner, repo)));
  } catch (err) {
    console.error("Échec du build Zola:", err.log || err.message);
    throw err;
  }

  await api.publishFiles(owner, repo, "pages", output);

  // Best-effort : certains fournisseurs (GitLab) exigent un pipeline CI pour publier quoi
  // que ce soit, qui peut rester bloqué indéfiniment faute de runner disponible — voir
  // GitLabApi.checkPublishHealth(). Pas d'équivalent Forgejo/GitHub (aucun des deux ne
  // dépend d'un pipeline pour publier), d'où l'appel optionnel (`?.`) plutôt qu'une méthode
  // obligatoire sur tous les clients. Un échec de cette vérification ne doit pas faire
  // échouer la publication elle-même (déjà faite à ce stade).
  let warning = null;
  if (api.checkPublishHealth) {
    try {
      warning = await api.checkPublishHealth(owner, repo, "pages");
    } catch (err) {
      console.error("Échec de la vérification de santé du pipeline:", err.message);
    }
  }

  return { pageCount: Object.keys(output).length, warning };
}
