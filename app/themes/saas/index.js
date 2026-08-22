import { tokens } from "./tokens.js";
import { templates } from "./templates.js";

/** @type {import("../types.js").Theme} */
export const saas = {
  id: "saas",
  label: "SaaS",
  description: "Landing page produit, conversion-focused — inspiré d'Outseta.",
  tokens,
  fontLinks: [{ href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap", preconnect: true }],
  templates,
};
