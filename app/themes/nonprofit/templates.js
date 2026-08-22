// Gabarits par défaut du thème "nonprofit" (voir tokens.js) — Nav → Hero (mission + don)
// → Stats → FeatureGrid → actualités → Cta (don) → Footer sur l'accueil, même structure
// Nav/ContentSlot/Footer que app/ssg/default-templates.js pour page/article. Le "Blog"
// générique devient "Actualités" (même route /blog/, juste un intitulé adapté).

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
        eyebrow: "Association",
        title: "Un accès à l'eau potable pour tous",
        subtitle: "Nous finançons et suivons des projets d'accès à l'eau potable dans les communautés qui en ont le plus besoin.",
        ctaLabel: "Faire un don",
        ctaUrl: "#",
        align: "center",
        spacing: "lg",
      }),
    },
    {
      type: "Stats",
      props: {
        id: "home-stats",
        title: "",
        columns: 3,
        stats: [
          { value: "128", label: "projets financés" },
          { value: "340 000+", label: "personnes bénéficiaires" },
          { value: "92%", label: "des dons alloués sur le terrain" },
        ],
        backgroundColor: tokens.surfaceAlt,
        textColor: tokens.ink,
      },
    },
    {
      type: "FeatureGrid",
      props: {
        id: "home-actions",
        title: "Nos actions",
        columns: 3,
        spacing: "md",
        backgroundColor: tokens.surface,
        textColor: tokens.ink,
        features: [
          { icon: "💧", title: "Accès à l'eau", description: "Financement de forages et de systèmes de captage dans les zones prioritaires." },
          { icon: "🏫", title: "Sensibilisation", description: "Interventions en milieu scolaire sur l'hygiène et la gestion de l'eau." },
          { icon: "🤝", title: "Partenariats locaux", description: "Accompagnement d'associations locales pour un impact durable." },
        ],
      },
    },
    { type: "Heading", props: { id: "home-news-heading", text: "Dernières actualités", level: "h2", align: "left" } },
    { type: "ArticleCard", props: articleCardProps("home-news", tokens, { limit: 3, columns: 3 }) },
    {
      type: "Cta",
      props: {
        id: "home-cta",
        title: "Chaque don compte",
        text: "10€ suffisent à fournir de l'eau potable à une personne pendant un an.",
        buttonLabel: "Faire un don",
        buttonUrl: "#",
        spacing: "md",
        backgroundColor: tokens.accent,
        textColor: "#ffffff",
      },
    },
    {
      type: "SocialLinks",
      props: {
        id: "home-social",
        links: [
          { platform: "instagram", url: "#", label: "" },
          { platform: "linkedin", url: "#", label: "" },
          { platform: "email", url: "#", label: "Nous écrire" },
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
    { type: "Hero", props: heroProps("blog-index-hero", tokens, { title: "Actualités", spacing: "sm" }) },
    { type: "Repeater", props: blogListProps("blog-index-repeater", tokens) },
    { type: "Footer", props: footerProps("blog-index-footer", tokens) },
  ],
};

export const templates = { home, page, article, blogIndex };
