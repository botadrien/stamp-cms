// Version paramétrée par thème des prop-builders de app/ssg/default-templates.js : même
// forme exacte, mais reçoit les tokens du thème en cours d'écriture au lieu d'importer le
// TOKENS global unique — ce qui permet à chaque thème (app/themes/<id>/templates.js) de
// composer ses gabarits par défaut avec sa propre palette. app/ssg/default-templates.js
// n'est pas modifié : il reste le repli pour les sites sans thème (voir
// resolveThemeFromRepoFiles() dans app/site/site-builder.js).

/** @typedef {import("../types.js").ThemeTokens} ThemeTokens */

export const navProps = (id, tokens, extra = {}) => ({
  id,
  items: { $bind: "site.nav" },
  variant: "horizontal",
  backgroundColor: tokens.surface,
  textColor: tokens.ink,
  ...extra,
});

export const footerProps = (id, tokens, extra = {}) => ({
  id,
  siteName: { $bind: "site.title" },
  tagline: "",
  links: [],
  copyright: "",
  backgroundColor: tokens.surfaceAlt,
  textColor: tokens.ink,
  ...extra,
});

// Repeater + ArticleTeaser bindés sur la collection blog — mêmes props que blogListProps()
// dans app/ssg/default-templates.js, teinté avec l'accent du thème.
export const blogListProps = (id, tokens, { limit } = {}) => ({
  id,
  source: { $bind: "collection", from: "blog", sortBy: "date", order: "desc", ...(limit ? { limit } : {}) },
  content: [
    {
      type: "ArticleTeaser",
      props: {
        id: `${id}-teaser`,
        title: { $bind: "item.title" },
        date: { $bind: "item.date" },
        excerpt: { $bind: "item.excerpt" },
        url: { $bind: "item.url" },
        accentColor: tokens.accent,
      },
    },
  ],
});

export const heroProps = (id, tokens, { eyebrow = "", title, subtitle = "", ctaLabel = "", ctaUrl = "", align = "left", spacing = "md" }) => ({
  id,
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaUrl,
  align,
  spacing,
  backgroundColor: tokens.surface,
  textColor: tokens.ink,
});

// Aucun token nécessaire : ContentSlot n'a pas de champ couleur (voir content-slot.jsx),
// identique à contentSlotProps() dans app/ssg/default-templates.js.
export const contentSlotProps = (id, { showDate }) => ({
  id,
  showTitle: true,
  showDate,
  content: [{ type: "RichText", props: { id: `${id}-placeholder`, body: "<p>Corps de la page…</p>" } }],
});

export const articleCardProps = (id, tokens, { limit = 3, columns = 3 } = {}) => ({
  id,
  source: { $bind: "collection", from: "blog", sortBy: "date", order: "desc", limit },
  columns,
  accentColor: tokens.accent,
});
