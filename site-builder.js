// Orchestration du "vrai" site statique (Zola, via ZolaBuilder — voir
// editor-src/zola-builder.js) : gabarit fixe (templates + config.toml) + contenu
// Markdown récupéré sur la branche main, buildé en mémoire, publié sur la branche
// pages. Utilisé à la fois à la création du site et à chaque "Publier".

const ZOLA_TEMPLATE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.6; }
  nav { display: flex; gap: 16px; margin-bottom: 32px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
  nav a { color: inherit; text-decoration: none; }
  nav a[aria-current="page"] { font-weight: 600; text-decoration: underline; }
`;

function zolaScaffold(title, baseUrl) {
  return {
    "config.toml": `title = "${title}"\nbase_url = "${baseUrl}"\ncompile_sass = false\nbuild_search_index = false\n`,
    "templates/macros.html": `{% macro nav(current_permalink) %}
<nav>
{% set home = get_section(path="_index.md", metadata_only=true) %}
<a href="{{ home.permalink }}"{% if home.permalink == current_permalink %} aria-current="page"{% endif %}>Accueil</a>
{% for p in home.pages %}<a href="{{ p.permalink }}"{% if p.permalink == current_permalink %} aria-current="page"{% endif %}>{{ p.title }}</a>
{% endfor %}
</nav>
{% endmacro nav %}
`,
    "templates/index.html": `{% import "macros.html" as macros %}
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{ section.title | default(value=config.title) }}</title>
<style>${ZOLA_TEMPLATE_STYLE}</style></head>
<body>
{{ macros::nav(current_permalink=section.permalink) }}
<main><h1>{{ section.title }}</h1>{{ section.content | safe }}</main>
</body>
</html>
`,
    "templates/page.html": `{% import "macros.html" as macros %}
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{ page.title }}</title>
<style>${ZOLA_TEMPLATE_STYLE}</style></head>
<body>
{{ macros::nav(current_permalink=page.permalink) }}
<main><h1>{{ page.title }}</h1>{{ page.content | safe }}</main>
</body>
</html>
`,
    "content/_index.md": `+++\ntitle = "Accueil"\n+++\n\nSite en construction.\n`,
  };
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
function ensureFrontMatter(markdown, path) {
  if (/^(\+\+\+|---)\s*$/m.test(markdown.split("\n", 1)[0])) return markdown;
  const heading = markdown.match(/^#\s+(.+)$/m);
  const title = (heading ? heading[1] : titleFromPath(path)).replace(/"/g, '\\"');
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

// Parcourt récursivement content/ sur main et retourne { "content/x.md": "...", ... }.
async function fetchContentFiles(owner, repo) {
  const files = {};

  async function walk(dirPath) {
    let entries;
    try {
      entries = await api.listContents(owner, repo, dirPath, "main");
    } catch (err) {
      if (err.status === 404) return; // pas encore de contenu à ce chemin
      throw err;
    }
    for (const entry of entries) {
      if (entry.type === "dir") {
        await walk(entry.path);
      } else if (entry.path.endsWith(".md")) {
        const file = await api.getFile(owner, repo, entry.path, "main");
        // Garantit un front matter même sur des pages créées avant que ça soit
        // automatique (ou modifiées hors du POC) — Zola refuse de builder le site
        // entier si UN SEUL fichier content/*.md en est dépourvu.
        files[entry.path] = ensureFrontMatter(decodeBase64Utf8(file.content), entry.path);
      }
    }
  }

  await walk("content");
  return files;
}

// Écrit un fichier sur la branche pages, en récupérant son sha existant si besoin
// (sinon Forgejo refuse l'écrasement — même logique que pour la branche main).
async function publishFile(owner, repo, path, content) {
  let sha = null;
  try {
    const existing = await api.getFile(owner, repo, path, "pages");
    sha = existing.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  await api.saveFile(owner, repo, path, content, { sha, branch: "pages", message: "Publication du site" });
}

// Récupère tout le contenu Markdown actuel + le gabarit fixe, buildit avec Zola (en
// mémoire, dans le navigateur), et publie chaque fichier produit sur la branche pages.
async function rebuildAndPublishSite(owner, repo) {
  const contentFiles = await fetchContentFiles(owner, repo);
  const scaffold = zolaScaffold(repo, api.pagesUrl(owner, repo));
  const files = { ...scaffold, ...contentFiles };

  let output;
  try {
    ({ files: output } = await ZolaBuilder.buildSite(files));
  } catch (err) {
    console.error("Échec du build Zola:", err.log || err.message);
    throw err;
  }

  for (const [path, content] of Object.entries(output)) {
    await publishFile(owner, repo, path, content);
  }

  return { pageCount: Object.keys(output).length };
}
