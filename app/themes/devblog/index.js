import { tokens } from "./tokens.js";
import { templates } from "./templates.js";

/** @type {import("../types.js").Theme} */
export const devblog = {
  id: "devblog",
  label: "Blog dev",
  description: "Blog perso orienté développement — inspiré de Josh W. Comeau.",
  tokens,
  fontLinks: [{ href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap", preconnect: true }],
  templates,
};
