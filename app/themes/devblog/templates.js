// Gabarits par défaut du thème "devblog" (voir tokens.js) — Nav → Hero (perso, aligné à
// gauche) → derniers billets → SocialLinks → Footer sur l'accueil, même structure
// Nav/ContentSlot/Footer que app/ssg/default-templates.js pour page/article.

import { tokens } from "./tokens.js";
import { navProps, footerProps, blogListProps, heroProps, contentSlotProps, articleCardProps } from "../shared/builders.js";

/** @typedef {import("@puckeditor/core").Data} PuckData */

/** @type {PuckData} */
const home = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("home-nav", tokens) },
    {
      type: "Hero",
      props: heroProps("home-hero", tokens, {
        title: "Salut, moi c'est votre nom 👋",
        subtitle: "J'écris ici sur le développement web, les bugs qui m'ont pris trop de temps à comprendre, et tout ce qui me passionne côté code.",
        align: "left",
        spacing: "lg",
      }),
    },
    { type: "Heading", props: { id: "home-recent-heading", text: "Derniers articles", level: "h2", align: "left" } },
    { type: "ArticleCard", props: articleCardProps("home-articles", tokens, { limit: 3, columns: 3 }) },
    {
      type: "SocialLinks",
      props: {
        id: "home-social",
        links: [
          { platform: "github", url: "#", label: "" },
          { platform: "mastodon", url: "#", label: "" },
          { platform: "rss", url: "/rss.xml", label: "Flux RSS" },
        ],
      },
    },
    { type: "Footer", props: footerProps("home-footer", tokens) },
  ],
};

/** @type {PuckData} */
const page = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("page-nav", tokens) },
    { type: "ContentSlot", props: contentSlotProps("page-content", { showDate: false }), readOnly: { content: true } },
    { type: "Footer", props: footerProps("page-footer", tokens) },
  ],
};

/** @type {PuckData} */
const article = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("article-nav", tokens) },
    { type: "ContentSlot", props: contentSlotProps("article-content", { showDate: true }), readOnly: { content: true } },
    { type: "Footer", props: footerProps("article-footer", tokens) },
  ],
};

/** @type {PuckData} */
const blogIndex = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("blog-index-nav", tokens) },
    { type: "Hero", props: heroProps("blog-index-hero", tokens, { title: "Blog", spacing: "sm" }) },
    { type: "Repeater", props: blogListProps("blog-index-repeater", tokens) },
    { type: "Footer", props: footerProps("blog-index-footer", tokens) },
  ],
};

export const templates = { home, page, article, blogIndex };
