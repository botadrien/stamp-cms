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
compile_sass = true
build_search_index = true

taxonomies = [
  { name = "categories" },
  { name = "tags" },
]

[markdown.highlighting]
theme = "nord"

[search]
index_format = "elasticlunr_json"

[extra]
# Pas encore éditable depuis le CMS (voir écran "Réglages du site" pour le titre du
# blog, le seul réglage exposé pour l'instant).
author_name = "Auteur du site"
author_bio = "Ce site est propulsé par CMS Statique."
sidebar_position = "left"
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
generate_feeds = true
+++
`;
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

// Synchronise la copie de travail locale (clone/fetch + reset dur, voir git-client.js)
// puis parcourt récursivement content/ pour appeler visit(path) sur chaque fichier .md
// trouvé — partagé entre fetchContentFiles() et listContentPages().
async function walkContentFiles(owner, repo, visit) {
  await GitClient.sync(owner, repo, "main");
  const paths = await GitClient.listFiles(owner, repo, "main", "content");
  for (const path of paths) {
    if (path.endsWith(".md")) await visit(path);
  }
}

// Parcourt récursivement content/ sur main et retourne { "content/x.md": "...", ... }.
// Utilisé pour le *build* — inclut les _index.md (sections), contrairement à
// listContentPages() qui les exclut de la liste "pages" éditable.
async function fetchContentFiles(owner, repo) {
  const files = {};
  await walkContentFiles(owner, repo, async (path) => {
    const markdown = await GitClient.readFile(owner, repo, "main", path);
    // Garantit un front matter même sur des pages créées avant que ça soit
    // automatique (ou modifiées hors du POC) — Zola refuse de builder le site
    // entier si UN SEUL fichier content/*.md en est dépourvu.
    files[path] = ensureFrontMatter(markdown, path);
  });
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
// éditables via l'éditeur riche).
async function listContentPages(owner, repo) {
  const pages = [];
  await walkContentFiles(owner, repo, async (path) => {
    if (path.endsWith("_index.md")) return;
    const markdown = await GitClient.readFile(owner, repo, "main", path);
    const type = path.startsWith("content/blog/") ? "post" : "page";
    pages.push({ path, title: extractTitle(markdown, path), type });
  });
  pages.sort((a, b) => a.title.localeCompare(b.title));
  return pages;
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
  await GitClient.sync(owner, repo, "main");
  try {
    const markdown = await GitClient.readFile(owner, repo, "main", "content/_index.md");
    return extractTitle(markdown, "content/_index.md");
  } catch (err) {
    if (err.status === 404) return repo;
    throw err;
  }
}

async function setBlogTitle(owner, repo, title) {
  await GitClient.sync(owner, repo, "main");
  await GitClient.writeFile(owner, repo, "main", "content/_index.md", buildIndexStub(title));
  await GitClient.commitAndPush(owner, repo, "main", "Mise à jour du titre du blog");
}

// Récupère tout le contenu Markdown actuel + le thème vendoré, buildit avec Zola (en
// mémoire, dans le navigateur), et publie le résultat sur la branche pages : la copie de
// travail locale est réconciliée pour correspondre exactement à la sortie de Zola (tout
// fichier suivi qui n'est plus dans `output` est supprimé — vraie sémantique de
// remplacement, contrairement à l'ancienne boucle REST qui ne touchait que les chemins
// connus et ne supprimait jamais les fichiers publiés devenus obsolètes), puis un seul
// commit+push.
async function rebuildAndPublishSite(owner, repo) {
  const contentFiles = await fetchContentFiles(owner, repo);
  const themeFiles = await loadThemeFiles(CURRENT_THEME);

  const title = contentFiles["content/_index.md"]
    ? extractTitle(contentFiles["content/_index.md"], "content/_index.md")
    : repo;
  const standalonePages = Object.keys(contentFiles)
    .filter((path) => !path.endsWith("_index.md") && !path.startsWith("content/blog/"))
    .map((path) => ({ path, title: extractTitle(contentFiles[path], path) }));

  const files = {
    ...themeFiles,
    "config.toml": buildConfigToml({ title, baseUrl: api.pagesUrl(owner, repo), standalonePages }),
    ...contentFiles,
  };
  if (!files["content/_index.md"]) files["content/_index.md"] = buildIndexStub(repo);
  if (!files["content/blog/_index.md"]) files["content/blog/_index.md"] = buildBlogIndexStub();

  let output;
  try {
    ({ files: output } = await ZolaBuilder.buildSite(files));
  } catch (err) {
    console.error("Échec du build Zola:", err.log || err.message);
    throw err;
  }

  await GitClient.sync(owner, repo, "pages");
  const existingPaths = await GitClient.listFiles(owner, repo, "pages", "");
  const outputPaths = new Set(Object.keys(output));
  for (const path of existingPaths) {
    if (!outputPaths.has(path)) {
      await GitClient.remove(owner, repo, "pages", path);
    }
  }
  for (const [path, bytes] of Object.entries(output)) {
    await GitClient.writeFile(owner, repo, "pages", path, bytes);
  }
  await GitClient.commitAndPush(owner, repo, "pages", "Publication du site");

  return { pageCount: Object.keys(output).length };
}
