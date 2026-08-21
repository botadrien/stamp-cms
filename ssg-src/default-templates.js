// Intégration app (remplacement de Zola, voir docs/plan-puck-ssg.md) : gabarits Puck
// utilisés par TOUS les sites, faute de stockage/éditeur .puck.json par site pour
// l'instant (voir "Points ouverts" du plan) — équivalent du thème volks-typo fixe
// d'avant, mais en Data Puck plutôt qu'en fichiers Tera. Un seul jeu de gabarits,
// partagé, donc chaque champ qui varie d'un site à l'autre (titre du site, nav, liste
// d'articles) doit être un binding plutôt qu'une valeur tapée en dur ici.

import { TOKENS } from "./design-tokens.js";

/** @typedef {import("@puckeditor/core").Data} PuckData */

const navProps = (id) => ({
  id,
  items: { $bind: "site.nav" },
  variant: "horizontal",
  backgroundColor: TOKENS.surface,
  textColor: TOKENS.ink,
});

const footerProps = (id) => ({
  id,
  siteName: { $bind: "site.title" },
  tagline: "",
  links: [],
  copyright: "",
  backgroundColor: TOKENS.surfaceAlt,
  textColor: TOKENS.ink,
});

// Repeater + ArticleTeaser bindés sur la collection blog — voir ssg-src/components/
// repeater.jsx et article-teaser.jsx. `limit` omis : toute la collection.
const blogListProps = (id, { limit } = {}) => ({
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
        accentColor: TOKENS.accent,
      },
    },
  ],
});

/** @type {PuckData} */
const home = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("home-nav") },
    { type: "Repeater", props: blogListProps("home-repeater", { limit: 5 }) },
    { type: "Footer", props: footerProps("home-footer") },
  ],
};

/** @type {PuckData} */
const page = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("page-nav") },
    { type: "PageContent", props: { id: "page-content", showTitle: true, showDate: false } },
    { type: "Footer", props: footerProps("page-footer") },
  ],
};

/** @type {PuckData} */
const article = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("article-nav") },
    { type: "PageContent", props: { id: "article-content", showTitle: true, showDate: true } },
    { type: "Footer", props: footerProps("article-footer") },
  ],
};

/** @type {PuckData} */
const blogIndex = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("blog-index-nav") },
    { type: "Repeater", props: blogListProps("blog-index-repeater") },
    { type: "Footer", props: footerProps("blog-index-footer") },
  ],
};

export const defaultTemplates = { home, page, article, blogIndex };
