/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "Hero", statique — texte tapé
 * en dur par l'auteur·ice, pas de champ binding (voir la brief Track D : les
 * composants statiques hero/CTA/grille n'ont besoin de rien d'autre). Style en
 * custom properties CSS + style inline, pas de Sass.
 *
 * Défauts visuels inspirés de https://demo.puckeditor.com/ (voir ssg-src/design-tokens.js) :
 * fond clair, titre noir en gras serré, bouton plein accent bleu — toujours éditable via
 * backgroundColor/textColor.
 */

import { TOKENS, solidButtonStyle } from "../design-tokens.js";

const ALIGN_OPTIONS = [
  { label: "Aligné à gauche", value: "left" },
  { label: "Centré", value: "center" },
];

const SPACING = { sm: "2.5rem", md: "4rem", lg: "6rem" };
const SPACING_OPTIONS = Object.keys(SPACING).map((value) => ({ label: value, value }));

export const Hero = {
  label: "Hero",
  fields: {
    eyebrow: { type: "text", label: "Accroche (au-dessus du titre)" },
    title: { type: "text", label: "Titre" },
    subtitle: { type: "textarea", label: "Sous-titre" },
    ctaLabel: { type: "text", label: "Texte du bouton" },
    ctaUrl: { type: "text", label: "Lien du bouton" },
    align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
    spacing: { type: "select", label: "Espacement vertical", options: SPACING_OPTIONS },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    eyebrow: "",
    title: "Titre de la page",
    subtitle: "",
    ctaLabel: "",
    ctaUrl: "",
    align: "left",
    spacing: "md",
    backgroundColor: TOKENS.surface,
    textColor: TOKENS.ink,
  },
  render: ({ eyebrow, title, subtitle, ctaLabel, ctaUrl, align, spacing, backgroundColor, textColor }) => {
    const paddingBlock = SPACING[spacing] ?? SPACING.md;
    const centered = align === "center";
    return (
      <section
        style={{
          "--ssg-hero-bg": backgroundColor || TOKENS.surface,
          "--ssg-hero-fg": textColor || TOKENS.ink,
          backgroundColor: "var(--ssg-hero-bg)",
          color: "var(--ssg-hero-fg)",
          padding: `${paddingBlock} 1.5rem`,
          textAlign: centered ? "center" : "left",
          fontFamily: TOKENS.fontFamily,
        }}
      >
        <div style={{ maxWidth: "48rem", margin: centered ? "0 auto" : "0" }}>
          {eyebrow ? (
            <p
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: TOKENS.accent,
                margin: "0 0 0.75rem",
              }}
            >
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h1
              style={{
                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                margin: "0 0 1rem",
                lineHeight: 1.05,
              }}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              style={{
                fontSize: "1.1875rem",
                color: "var(--ssg-hero-fg)",
                opacity: 0.72,
                margin: "0 0 1.75rem",
                lineHeight: 1.55,
              }}
            >
              {subtitle}
            </p>
          ) : null}
          {ctaLabel && ctaUrl ? (
            <a href={ctaUrl} style={solidButtonStyle(TOKENS.accent, "#ffffff")}>
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </section>
    );
  },
};
