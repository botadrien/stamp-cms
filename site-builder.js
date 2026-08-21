// Orchestration du "vrai" site statique (renderer Puck, via SsgBuilder — voir
// editor-src/ssg-builder.js et ssg-src/renderer.jsx) : contenu Markdown récupéré sur la
// branche main, buildé en mémoire avec les gabarits Puck par défaut
// (ssg-src/default-templates.js), publié sur la branche pages. Utilisé à la fois à la
// création du site et à chaque "Publier". Remplace l'ancien pipeline Zola/Tera (voir
// docs/plan-puck-ssg.md) — plus de thème vendoré à copier dans chaque repo, plus de
// config.toml généré : le renderer Puck ne dépend d'aucun fichier au-delà de content/.

function escapeToml(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Chemin repo <-> clé de gabarit (voir ssg-src/default-templates.js pour les clés :
// home/page/article/blogIndex) — un fichier .puck.json par type de route, à la racine de
// templates/ (à côté de rien d'autre, l'ancien templates/*.html Tera n'existe plus). Un
// site sans éditeur de mise en page utilisé retombe sur SsgBuilder.defaultTemplates
// (voir loadLayoutTemplates ci-dessous) : ces fichiers ne sont écrits qu'à la première
// sauvegarde depuis l'écran "Mise en page" (openLayoutEditor() dans app.js).
const LAYOUT_TEMPLATE_FILES = {
  home: "templates/home.puck.json",
  page: "templates/page.puck.json",
  article: "templates/article.puck.json",
  blogIndex: "templates/blog-index.puck.json",
};

// Libellés affichés sur l'écran "Mise en page" (app.js) — mêmes clés que
// LAYOUT_TEMPLATE_FILES/SsgBuilder.defaultTemplates.
const LAYOUT_TEMPLATE_LABELS = {
  home: "Accueil",
  page: "Page standalone",
  article: "Article de blog",
  blogIndex: "Index du blog",
};

// URL d'une page à partir de son chemin content/ (content/a-propos.md -> /a-propos/) —
// même convention que pageUrl() dans ssg-src/content-loader.js (dupliquée ici plutôt
// qu'importée : ce fichier reste un script classique global, pas un module).
function pageUrl(path) {
  return "/" + path.replace(/^content\//, "").replace(/\.md$/, "") + "/";
}

// content/_index.md : front matter seul, plus de corps Markdown — la page d'accueil
// n'est plus éditée via l'éditeur riche (le gabarit "home" par défaut, voir
// ssg-src/default-templates.js, se charge de l'affichage). Le titre est le seul réglage
// éditable de l'accueil pour l'instant (voir getBlogTitle/setBlogTitle).
function buildIndexStub(title) {
  return `+++
title = "${escapeToml(title)}"
+++
`;
}

// content/blog/_index.md : section blog, structurelle (pas encore éditable depuis le CMS).
function buildBlogIndexStub() {
  return `+++
title = "Blog"
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

// Le loader de contenu (ssg-src/content-loader.js) attend un front matter ("+++" en
// tête) sur tout fichier content/*.md — notre éditeur riche n'en écrit pas. On l'ajoute
// automatiquement si absent, de façon invisible pour l'utilisateur·rice (titre déduit du
// premier titre tapé, sinon du nom de fichier). Un article de blog (content/blog/...)
// reçoit une date, pas une page standalone.
function ensureFrontMatter(markdown, path) {
  if (/^(\+\+\+|---)\s*$/m.test(markdown.split("\n", 1)[0])) return markdown;
  const heading = markdown.match(/^#\s+(.+)$/m);
  const title = (heading ? heading[1] : titleFromPath(path)).replace(/"/g, '\\"');
  if (path.startsWith("content/blog/")) {
    const date = new Date().toISOString().slice(0, 10);
    return `+++\ntitle = "${title}"\ndate = ${date}\n+++\n\n${markdown}`;
  }
  return `+++\ntitle = "${title}"\n+++\n\n${markdown}`;
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

// Récupère tout le contenu de content/ sur main et retourne { "content/x.md": "...", ... }
// — décodé depuis le cache local de tout le dépôt (voir repo-cache.js ; getRepoFiles ne
// retélécharge que si le sha HEAD distant a changé depuis le dernier appel). Utilisé pour
// le *build* — inclut les _index.md (sections), contrairement à listContentPages() qui
// les exclut de la liste "pages" éditable.
async function fetchContentFiles(owner, repo) {
  const repoFiles = await getRepoFiles(owner, repo, api);
  const files = {};
  for (const [path, bytes] of Object.entries(repoFiles)) {
    if (!path.startsWith("content/") || !path.endsWith(".md")) continue;
    // Garantit un front matter même sur des pages créées avant que ça soit automatique
    // (ou modifiées hors du CMS) — le loader de contenu (ssg-src/content-loader.js)
    // refuse tout fichier content/*.md qui en serait dépourvu.
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

// Domaine personnalisé du site (voir README, section "Domaine personnalisé") : stocké
// dans un fichier dédié à la racine du dépôt plutôt que dans le front matter de
// content/_index.md (pas de lien logique avec le titre du blog) — première brique du
// futur "fichier structuré de config du site" évoqué dans README ("Architecture
// cœur/thèmes/plugins"). Jamais lu par le renderer (ni content/, ni le reste du dépôt) :
// reste un fichier source sur main, jamais publié sur la branche pages.
function extractCustomDomain(toml) {
  const match = toml.match(/^custom_domain\s*=\s*"(.*)"\s*$/m);
  return match ? match[1].replace(/\\"/g, '"') : null;
}

async function getCustomDomain(owner, repo) {
  try {
    const file = await api.getFile(owner, repo, "site.toml", "main", { silent404: true });
    return extractCustomDomain(decodeBase64Utf8(file.content));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function setCustomDomain(owner, repo, domain) {
  let sha = null;
  try {
    const existing = await api.getFile(owner, repo, "site.toml", "main", { silent404: true });
    sha = existing.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  // Rien à faire : pas de domaine à enregistrer, et aucun site.toml existant à vider (pas
  // de pattern de suppression de fichier dans les clients API, voir README — écrire un
  // fichier vide n'a d'intérêt que pour effacer un domaine déjà stocké).
  if (!domain && !sha) return;
  const toml = domain ? `custom_domain = "${escapeToml(domain)}"\n` : "";
  await api.saveFile(owner, repo, "site.toml", toml, {
    sha,
    message: domain ? "Mise à jour du domaine personnalisé" : "Suppression du domaine personnalisé",
  });
}

// Un gabarit Puck par clé (voir LAYOUT_TEMPLATE_FILES) : celui enregistré dans le repo
// via l'écran "Mise en page" (openLayoutEditor()/saveLayoutTemplate() dans app.js) s'il
// existe, sinon le défaut (SsgBuilder.defaultTemplates) — même logique de repli que
// getSiteFiles() avant lui pour le thème Zola (fusion fichier par fichier, jamais un
// tout-ou-rien) : un site n'ayant personnalisé qu'UN SEUL gabarit garde les trois autres
// par défaut. `drafts` : { chemin: "texte" } — un gabarit en cours d'édition, pas encore
// enregistré (même mécanique que pour le contenu, voir buildSiteFiles ci-dessous),
// utilisé par l'aperçu en direct de l'éditeur de mise en page.
function loadLayoutTemplates(repoFiles, drafts = {}) {
  const templates = {};
  for (const [key, path] of Object.entries(LAYOUT_TEMPLATE_FILES)) {
    const raw = path in drafts ? drafts[path] : repoFiles[path] ? new TextDecoder().decode(repoFiles[path]) : null;
    templates[key] = raw ? JSON.parse(raw) : SsgBuilder.defaultTemplates[key];
  }
  return templates;
}

// URL absolue du site publié (voir ssg-src/context.js) : le domaine personnalisé
// (site.toml, voir getCustomDomain/setCustomDomain) s'il est enregistré, sinon l'URL de
// pages du fournisseur connecté. `repoFiles` déjà en main chez l'appelant (getRepoFiles) —
// site.toml y est déjà présent, aucun aller-retour réseau supplémentaire.
function resolveBaseUrl(owner, repo, repoFiles) {
  const customDomain = repoFiles["site.toml"]
    ? extractCustomDomain(new TextDecoder().decode(repoFiles["site.toml"]))
    : null;
  return customDomain ? `https://${customDomain}/` : api.pagesUrl(owner, repo);
}

// Construit le site en mémoire (contenu du repo + gabarits Puck, personnalisés ou par
// défaut) sans rien publier — utilisé à la fois par rebuildAndPublishSite() et par
// buildPreviewSite() ci-dessous, qui ne diffèrent qu'après cet appel (l'un publie sur
// pages, l'autre sert direct via le service worker de preview). `repoFiles` : { chemin:
// Uint8Array } tel que renvoyé par getRepoFiles() (repo-cache.js), le contenu du dépôt de
// site tel quel sur la branche main. `drafts` : { chemin: "texte" } — une page/un article
// (ou un gabarit, voir loadLayoutTemplates) en cours d'édition, pas encore enregistré sur
// main, qui doit prendre le pas sur le contenu du repo pour cette preview. baseUrl doit
// être absolue (voir ssg-src/context.js) : l'URL réelle du site publié pour
// rebuildAndPublishSite(), l'URL /preview/<owner>/<repo>/ pour buildPreviewSite() — sinon
// les liens de nav pointeraient en absolu vers le vrai domaine de prod (qui n'a pas
// encore ce contenu), hors du scope intercepté par sw.js.
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
  if (!contentText["content/_index.md"]) contentText["content/_index.md"] = buildIndexStub(repo);
  if (!contentText["content/blog/_index.md"]) contentText["content/blog/_index.md"] = buildBlogIndexStub();

  const title = extractTitle(contentText["content/_index.md"], "content/_index.md");

  return SsgBuilder.buildSite({
    files: contentText,
    title,
    baseUrl,
    templates: loadLayoutTemplates(repoFiles, drafts),
  });
}

// Rebuild d'aperçu : récupère le repo (servi depuis le cache local si déjà à jour, voir
// getRepoFiles) et y substitue le brouillon en cours d'édition, non encore enregistré.
// Ne publie rien : la sortie est servie directement par sw.js. previewBaseUrl : voir
// previewBaseUrl() dans app.js — même chemin que celui utilisé pour naviguer l'iframe.
async function buildPreviewSite(owner, repo, draftPath, draftText, previewBaseUrl) {
  const repoFiles = await getRepoFiles(owner, repo, api);
  try {
    return await buildSiteFiles(owner, repo, repoFiles, previewBaseUrl, { [draftPath]: draftText });
  } catch (err) {
    console.error("Échec du build (aperçu):", err.log || err.message);
    throw err;
  }
}

// Récupère tout le dépôt (depuis le cache local ou fraîchement téléchargé si le sha
// distant a changé — voir getRepoFiles), rend le site avec le renderer Puck (en mémoire,
// dans le navigateur), et publie tous les fichiers produits sur la branche pages en un
// seul commit (voir api.publishFiles — un batch côté Forgejo, une séquence
// blob/tree/commit/ref via l'API Git Data côté GitHub, plutôt qu'un aller-retour
// get-sha+PUT séquentiel par fichier). `{ replace: true }` : pages est entièrement
// régénérée à chaque publication, donc tout fichier qui n'en fait plus partie doit
// disparaître (sinon d'anciens fichiers s'accumulent indéfiniment, notamment après un
// changement de renderer — voir le commentaire sur ForgejoApi.publishFiles, api.js).
async function rebuildAndPublishSite(owner, repo) {
  const repoFiles = await getRepoFiles(owner, repo, api);
  const baseUrl = resolveBaseUrl(owner, repo, repoFiles);

  let output;
  try {
    ({ files: output } = await buildSiteFiles(owner, repo, repoFiles, baseUrl));
  } catch (err) {
    console.error("Échec du build:", err.log || err.message);
    throw err;
  }

  await api.publishFiles(owner, repo, "pages", output, { replace: true });

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

// Section factice utilisée pour la prévisualisation d'un gabarit "article"/"blogIndex"
// dans l'éditeur de mise en page — mêmes title/slug/url que la vraie section blog (voir
// BLOG_SECTION dans ssg-src/renderer.jsx), dupliquée ici plutôt qu'importée (ce fichier
// reste un script classique, pas un module).
const LAYOUT_PREVIEW_BLOG_SECTION = { title: "Blog", slug: "blog", url: "/blog/" };

// Données nécessaires à l'écran "Mise en page" (openLayoutEditor() dans app.js) pour un
// type de gabarit donné : le gabarit lui-même (personnalisé ou par défaut, voir
// loadLayoutTemplates) et un Context de prévisualisation représentatif — la première
// page/le premier article existant (s'il y en a) pour que PageContent affiche du vrai
// contenu dans le canvas plutôt qu'un placeholder vide (voir page-content.jsx), plutôt
// qu'une donnée inventée qui ne correspondrait à rien de réel.
async function buildLayoutEditorData(owner, repo, key) {
  const repoFiles = await getRepoFiles(owner, repo, api);
  const templates = loadLayoutTemplates(repoFiles);
  const baseUrl = resolveBaseUrl(owner, repo, repoFiles);

  const contentFiles = await fetchContentFiles(owner, repo);
  const collections = await SsgBuilder.loadCollections(contentFiles);
  const title = contentFiles["content/_index.md"]
    ? extractTitle(contentFiles["content/_index.md"], "content/_index.md")
    : repo;

  const contextOpts = { title, baseUrl, collections };
  if (key === "page") contextOpts.page = collections.pages[0];
  if (key === "article") {
    contextOpts.page = collections.blog[0];
    contextOpts.section = LAYOUT_PREVIEW_BLOG_SECTION;
  }
  if (key === "blogIndex") contextOpts.section = LAYOUT_PREVIEW_BLOG_SECTION;

  return {
    data: templates[key],
    context: SsgBuilder.buildContext(contextOpts),
  };
}

// Enregistre un gabarit personnalisé (appelé depuis onPublish du bouton "Publish" natif
// de Puck, voir openLayoutEditor() dans app.js) et republie immédiatement le site avec —
// pas de brouillon local à gérer comme pour l'éditeur de contenu (voir
// buildPreviewSite/triggerPreviewBuild) : le canvas de Puck EST déjà l'aperçu en direct
// des changements, pas besoin d'un aller-retour de build à part pour ça.
async function saveLayoutTemplate(owner, repo, key, data) {
  const path = LAYOUT_TEMPLATE_FILES[key];
  let sha = null;
  try {
    const existing = await api.getFile(owner, repo, path, "main", { silent404: true });
    sha = existing.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  await api.saveFile(owner, repo, path, JSON.stringify(data, null, 2), {
    sha,
    message: `Mise à jour du gabarit "${LAYOUT_TEMPLATE_LABELS[key]}"`,
  });
  return rebuildAndPublishSite(owner, repo);
}
