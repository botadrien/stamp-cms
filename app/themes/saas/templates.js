// Gabarits par défaut du thème "saas" (voir tokens.js) — Nav → Hero → LogoCloud →
// FeatureGrid → Testimonial → PricingTable → Cta → Footer sur l'accueil, même structure
// Nav/ContentSlot/Footer que app/ssg/default-templates.js pour page/article.

import { tokens } from "./tokens.js";
import { navProps, footerProps, blogListProps, heroProps, contentSlotProps } from "../shared/builders.js";

/** @typedef {import("@puckeditor/core").Data} PuckData */

/** @type {PuckData} */
const home = {
  root: { props: {} },
  content: [
    { type: "Nav", props: navProps("home-nav", tokens) },
    {
      type: "Hero",
      props: heroProps("home-hero", tokens, {
        eyebrow: "Nouveau",
        title: "Gérez abonnements et clients au même endroit",
        subtitle: "La plateforme tout-en-un pour lancer et faire grandir votre SaaS, sans multiplier les outils.",
        ctaLabel: "Essayer gratuitement",
        ctaUrl: "#",
        align: "center",
        spacing: "lg",
      }),
    },
    {
      type: "LogoCloud",
      props: { id: "home-logos", title: "Ils nous font confiance", logos: [] },
    },
    {
      type: "FeatureGrid",
      props: {
        id: "home-features",
        title: "Tout ce qu'il faut pour vendre en ligne",
        columns: 3,
        spacing: "md",
        backgroundColor: tokens.surface,
        textColor: tokens.ink,
        features: [
          { icon: "💳", title: "Facturation automatisée", description: "Gérez abonnements, essais gratuits et factures sans écrire une ligne de code." },
          { icon: "👥", title: "CRM intégré", description: "Centralisez vos contacts, leads et conversations client au même endroit." },
          { icon: "📊", title: "Tableaux de bord", description: "Suivez churn, MRR et rétention en temps réel." },
        ],
      },
    },
    {
      type: "Testimonial",
      props: {
        id: "home-testimonial",
        quote: "Depuis qu'on a tout centralisé, on a divisé par deux le temps passé sur l'administratif.",
        name: "Camille Duret",
        role: "Fondatrice, Atelier Nova",
        avatarUrl: "",
        backgroundColor: tokens.surfaceAlt,
        textColor: tokens.ink,
      },
    },
    {
      type: "PricingTable",
      props: {
        id: "home-pricing",
        title: "Des tarifs simples, sans surprise",
        tiers: [
          { name: "Starter", price: "19€", period: "/mois", features: "Jusqu'à 100 clients\nFacturation automatisée\nSupport par e-mail", ctaLabel: "Commencer", ctaUrl: "#", featured: false },
          { name: "Croissance", price: "49€", period: "/mois", features: "Clients illimités\nCRM intégré\nSupport prioritaire", ctaLabel: "Essayer 14 jours", ctaUrl: "#", featured: true },
          { name: "Entreprise", price: "Sur devis", period: "", features: "SLA dédié\nOnboarding personnalisé\nAccès API", ctaLabel: "Nous contacter", ctaUrl: "#", featured: false },
        ],
      },
    },
    {
      type: "Cta",
      props: {
        id: "home-cta",
        title: "Prêt·e à simplifier votre gestion ?",
        text: "Rejoignez les équipes qui ont déjà remplacé cinq outils par un seul.",
        buttonLabel: "Démarrer maintenant",
        buttonUrl: "#",
        spacing: "md",
        backgroundColor: tokens.accent,
        textColor: "#ffffff",
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
