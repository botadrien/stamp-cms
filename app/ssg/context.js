// Construit l'objet Context (voir app/ssg/types.js) à partir des Collections produites
// par content-loader.js et des infos de site (titre, base_url, nav). La nav reprend
// exactement la logique de buildConfigToml() dans app/site/site-builder.js — "Accueil" + une
// entrée par page standalone (dans l'ordre de collections.pages) + "Blog" — recopiée ici
// en JS plutôt qu'en TOML Zola, pas une nouvelle logique de nav. base_url (le domaine
// personnalisé de site.toml, voir getCustomDomain()/setCustomDomain() dans
// app/site/site-builder.js, ou l'URL de pages du fournisseur sinon) est calculé par l'appelant
// exactement comme aujourd'hui (rebuildAndPublishSite()) et simplement transmis ici — ce
// module ne réimplémente pas cette décision, ni celle de la page/section "courante".

/** @typedef {import("./types.js").Context} Context */
/** @typedef {import("./types.js").Collections} Collections */
/** @typedef {import("./types.js").ContentItem} ContentItem */

// Construit la liste de nav { label, url } : Accueil, puis une entrée par page standalone
// (collections.pages, déjà dans l'ordre alphabétique par titre produit par
// content-loader.js — même ordre que listContentPages()), puis Blog. Même contenu que le
// `main_menu` généré par buildConfigToml(), juste en objets JS plutôt qu'en TOML.
function buildNav(pages) {
  return [
    { label: "Accueil", url: "/" },
    ...pages.map((p) => ({ label: p.title, url: p.url })),
    { label: "Blog", url: "/blog/" },
  ];
}

// Combine le préfixe de chemin de `site.baseUrl` (ex. "/mon-repo" pour un site
// GitHub/Codeberg/GitLab Pages publié sous un sous-chemin plutôt qu'à la racine du
// domaine, "" si publié à la racine) avec un chemin interne au site (`page.url`,
// `item.url`, entrée de `site.nav`, toujours racine-relatif au contenu — cette forme sert
// aussi à calculer les chemins de fichiers de sortie, voir urlToOutputPath() dans
// renderer.jsx, donc jamais préfixée elle-même). Tout composant qui émet un `href` à
// partir d'une valeur bindée doit passer par ici plutôt que d'utiliser le chemin brut —
// sans ça les liens casseraient sur tout site publié hors de la racine du domaine (ex.
// https://user.github.io/mon-repo/, cas le plus courant pour GitHub/Codeberg/GitLab
// Pages sans domaine personnalisé).
/**
 * @param {Context} context
 * @param {string} path
 * @returns {string}
 */
export function resolveHref(context, path) {
  let prefix = "";
  try {
    prefix = new URL(context.site.baseUrl).pathname.replace(/\/$/, "");
  } catch {
    prefix = "";
  }
  return prefix + path;
}

// Fabrique de Context. `title`/`baseUrl` : mêmes valeurs que celles passées à
// buildConfigToml() aujourd'hui (titre du front matter de content/_index.md, base_url du
// domaine personnalisé ou de l'URL de pages du fournisseur). `page`/`section` sont
// optionnels : l'appelant les renseigne selon la page en cours de rendu (ce module ne
// décide pas laquelle est "courante").
/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.baseUrl
 * @param {Collections} opts.collections
 * @param {ContentItem} [opts.page]
 * @param {{title: string, slug: string, url: string}} [opts.section]
 * @returns {Context}
 */
export function buildContext({ title, baseUrl, collections, page, section }) {
  /** @type {Context} */
  const context = {
    site: {
      title,
      baseUrl,
      nav: buildNav(collections.pages),
    },
    collections,
  };
  if (page) context.page = page;
  if (section) context.section = section;
  return context;
}
