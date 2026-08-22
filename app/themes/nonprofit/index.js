import { tokens } from "./tokens.js";
import { templates } from "./templates.js";

/** @type {import("../types.js").Theme} */
export const nonprofit = {
  id: "nonprofit",
  label: "Association",
  description: "Présentez votre mission et vos actualités — inspiré de charity: water.",
  tokens,
  fontLinks: [{ href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap", preconnect: true }],
  templates,
};
