/**
 * Générateur de sitemap.xml en JS pur.
 *
 * N'a besoin que de context.site.baseUrl et des collections à lister — voir
 * app/ssg/types.js pour la forme de Context/Collections/ContentItem.
 */

/** @typedef {import("../types.js").Context} Context */
/** @typedef {import("../types.js").ContentItem} ContentItem */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// baseUrl se termine toujours par "/" (voir getCustomDomain()/pagesUrl() dans
// app/providers/api.js/app/site/site-builder.js) et url commence toujours par "/" (page standalone/article, voir
// pageUrl() dans content-loader.js) ou est déjà écrit avec les deux "/" (routes
// structurelles ci-dessous, ex. "/blog/") — on retire le "/" final de baseUrl pour ne pas
// le dupliquer à la jonction.
function absoluteUrl(baseUrl, url) {
  return baseUrl.replace(/\/$/, "") + url;
}

function buildUrlEntry(baseUrl, url, lastmod) {
  const parts = ["  <url>", `    <loc>${escapeXml(absoluteUrl(baseUrl, url))}</loc>`];
  if (lastmod) {
    parts.push(`    <lastmod>${lastmod}</lastmod>`);
  }
  parts.push("  </url>");
  return parts.join("\n");
}

/**
 * Construit le XML d'un sitemap.xml à partir du Context : les routes structurelles
 * (accueil, index blog) + une entrée par ContentItem de chaque collection listée.
 *
 * @param {Context} context
 * @param {Object} [opts]
 * @param {("pages"|"blog")[]} [opts.collectionKeys=["pages","blog"]]
 * @param {string[]} [opts.structuralUrls=["/", "/blog/"]] - routes sans ContentItem associé
 * @returns {string} document XML complet (avec déclaration <?xml ... ?>)
 */
export function buildSitemap(
  context,
  { collectionKeys = ["pages", "blog"], structuralUrls = ["/", "/blog/"] } = {},
) {
  const { site, collections } = context;

  const structuralEntries = structuralUrls.map((url) => buildUrlEntry(site.baseUrl, url));

  const itemEntries = collectionKeys.flatMap((key) =>
    (collections[key] ?? []).map((item) => buildUrlEntry(site.baseUrl, item.url, item.date)),
  );

  const entries = [...structuralEntries, ...itemEntries].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
