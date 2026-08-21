/**
 * Générateur de flux RSS 2.0 en JS pur, écrit à `rss.xml`.
 *
 * N'a besoin que de context.site (title, baseUrl) et de la collection à publier — voir
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
// app/providers/api.js/app/site/site-builder.js) et url (ContentItem.url) commence toujours par "/" (voir
// pageUrl() dans content-loader.js) — on retire le "/" final de baseUrl pour ne pas le
// dupliquer à la jonction.
function absoluteUrl(baseUrl, url) {
  return baseUrl.replace(/\/$/, "") + url;
}

// ContentItem.date (voir content-loader.js: normalizeDate()) est une simple date ISO
// "YYYY-MM-DD", sans heure — interprétée à minuit UTC puis reformatée au format RFC 822
// qu'exige la balise <pubDate> de RSS 2.0.
function toRfc822(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toUTCString();
}

function buildItem(item, baseUrl) {
  const link = absoluteUrl(baseUrl, item.url);
  const parts = [
    "    <item>",
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid>${escapeXml(link)}</guid>`,
  ];
  if (item.date) {
    parts.push(`      <pubDate>${toRfc822(item.date)}</pubDate>`);
  }
  if (item.excerpt) {
    parts.push(`      <description>${escapeXml(item.excerpt)}</description>`);
  }
  parts.push("    </item>");
  return parts.join("\n");
}

/**
 * Construit le XML d'un flux RSS 2.0 à partir du Context et de la clé de collection à
 * publier ("blog" par défaut — la seule collection datée, les pages standalone n'ont pas
 * de date, voir app/ssg/context.js).
 *
 * @param {Context} context
 * @param {Object} [opts]
 * @param {"pages"|"blog"} [opts.collectionKey="blog"]
 * @param {number} [opts.limit] - nombre max d'items, défaut : toute la collection
 * @returns {string} document XML complet (avec déclaration <?xml ... ?>)
 */
export function buildRssFeed(context, { collectionKey = "blog", limit } = {}) {
  const { site, collections } = context;
  const items = collections[collectionKey] ?? [];
  const feedItems = typeof limit === "number" ? items.slice(0, limit) : items;

  const channelLink = absoluteUrl(site.baseUrl, "/");
  const itemsXml = feedItems.map((item) => buildItem(item, site.baseUrl)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(site.title)}</description>
${itemsXml}
  </channel>
</rss>
`;
}
