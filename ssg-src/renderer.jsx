/**
 * Tâche 5 (voir docs/plan-puck-ssg.md, "Grandes tâches") : orchestrateur qui parcourt
 * les routes du site, résout le gabarit Puck + le contenu de chaque page via
 * buildContext() (ssg-src/context.js), rend chaque page avec <Render> de Puck +
 * renderToStaticMarkup, et écrit le résultat dans une map { chemin: contenu } — même
 * forme que ZolaBuilder.buildSite() (editor-src/zola-builder.js) renvoie déjà
 * ({ files }), pour rester un remplacement direct de l'appel Zola dans
 * site-builder.js le jour où ce renderer est branché sur l'app (pas fait ici :
 * site-builder.js/app.js ne sont pas modifiés par cette tâche, qui ne construit que le
 * renderer lui-même).
 *
 * Ne pré-résout PAS les props du gabarit Puck avant <Render> : seul le Context racine
 * est fourni, via <SsgContext.Provider> (voir ssg-src/ssg-context.js). Chaque composant
 * bindable (palette, Repeater) résout ses propres props au moment du rendu via
 * useSsgContext()/resolveProps() — une résolution globale et préalable de tout l'arbre
 * casserait les bindings `item.*` du slot d'un Repeater, résolus avant que celui-ci
 * n'ait injecté `item` dans le Context pour cette itération.
 *
 * Pas encore de stockage `.puck.json` dans le dépôt (voir "Points ouverts" du plan) :
 * les gabarits sont donc fournis par l'appelant (`templates`), un par type de route —
 * même principe que le `template`/`page_template` du front matter Zola aujourd'hui
 * (ensureFrontMatter()/buildBlogIndexStub() dans site-builder.js), pas une nouvelle
 * idée. Pas de gabarit de page/article "avec corps rendu" fourni ici : aucun composant
 * de la palette ne bind encore sur `page.body`/`item.body` (voir feuille de route,
 * "Palette de composants") — hors scope du point de contrôle prototype (tâche 10),
 * qui porte sur "page d'index avec Repeater".
 */

import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core";
import { loadCollections } from "./content-loader.js";
import { buildContext } from "./context.js";
import { SsgContext } from "./ssg-context.js";
import { puckConfig } from "./registry.jsx";
import { buildRssFeed } from "./feeds/rss.js";
import { buildSitemap } from "./feeds/sitemap.js";

/** @typedef {import("./types.js").Context} Context */
/** @typedef {import("./types.js").Collections} Collections */

// Section structurelle du blog — mêmes title/slug/url que buildBlogIndexStub() +
// pageUrl() produiraient côté Zola pour content/blog/_index.md.
const BLOG_SECTION = { title: "Blog", slug: "blog", url: "/blog/" };

// url (voir pageUrl() dans content-loader.js) est toujours de la forme "/segment/" ou
// "/" — convertit en chemin de fichier de sortie style répertoire (comme Zola :
// des/urls/ -> des/urls/index.html), cohérent avec l'hébergement statique visé
// (GitHub/Codeberg/GitLab Pages).
function urlToOutputPath(url) {
  if (url === "/") return "index.html";
  return url.replace(/^\//, "") + "index.html";
}

function pageTitle(context) {
  const current = context.page?.title ?? context.section?.title;
  return current ? `${current} — ${context.site.title}` : context.site.title;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Rend un gabarit Puck (Data Puck : { root, content }) pour un Context donné en un
// document HTML complet. `<SsgContext.Provider>` rend le Context disponible à tout
// composant bindable de l'arbre, sans passer par le hook `resolveData` de Puck (voir
// docstring de repeater.jsx pour pourquoi les deux sont des choses distinctes).
function renderPuckPage(puckData, context) {
  const bodyHtml = renderToStaticMarkup(
    <SsgContext.Provider value={context}>
      <Render config={puckConfig} data={puckData} />
    </SsgContext.Provider>,
  );
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pageTitle(context))}</title>
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(context.site.title)}" href="/rss.xml">
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

/**
 * Construit le site entier en mémoire : accueil, chaque page standalone, index du
 * blog, chaque article, plus rss.xml/sitemap.xml (Track E).
 *
 * @param {Object} opts
 * @param {Object.<string, string|Uint8Array>} opts.files - contenu du dépôt, voir loadCollections()
 * @param {string} opts.title
 * @param {string} opts.baseUrl
 * @param {{home: Object, page: Object, blogIndex: Object, article: Object}} opts.templates - un gabarit Puck par type de route
 * @returns {Promise<{ files: Object.<string, Uint8Array> }>}
 */
export async function buildSite({ files, title, baseUrl, templates }) {
  const collections = await loadCollections(files);
  /** @type {Object.<string, string>} */
  const output = {};

  const rootContext = buildContext({ title, baseUrl, collections });
  output[urlToOutputPath("/")] = renderPuckPage(templates.home, rootContext);

  for (const page of collections.pages) {
    const context = buildContext({ title, baseUrl, collections, page });
    output[urlToOutputPath(page.url)] = renderPuckPage(templates.page, context);
  }

  const blogIndexContext = buildContext({ title, baseUrl, collections, section: BLOG_SECTION });
  output[urlToOutputPath(BLOG_SECTION.url)] = renderPuckPage(templates.blogIndex, blogIndexContext);

  for (const article of collections.blog) {
    const context = buildContext({ title, baseUrl, collections, page: article, section: BLOG_SECTION });
    output[urlToOutputPath(article.url)] = renderPuckPage(templates.article, context);
  }

  output["rss.xml"] = buildRssFeed(rootContext);
  output["sitemap.xml"] = buildSitemap(rootContext);

  // Encodé en Uint8Array pour tout le monde, jamais en string : même contrat que
  // ZolaBuilder.buildSite() avant lui (voir editor-src/zola-builder.js) — les
  // consommateurs (api.publishFiles(), qui base64-encode via bytesToBase64(), et sw.js
  // pour l'aperçu) attendent des octets, pas du texte.
  const encoder = new TextEncoder();
  /** @type {Object.<string, Uint8Array>} */
  const encodedOutput = {};
  for (const [path, content] of Object.entries(output)) {
    encodedOutput[path] = encoder.encode(content);
  }

  return { files: encodedOutput };
}
