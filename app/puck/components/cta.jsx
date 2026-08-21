/**
 * Composant Puck "Cta" (appel à l'action), statique — pas de champ binding. Style en
 * custom properties CSS + style inline, pas de Sass.
 *
 * Défauts visuels inspirés du bloc "Stats" en dégradé bleu de
 * https://demo.puckeditor.com/ (voir app/puck/design-tokens.js) : carte pleine largeur,
 * dégradé accent, coins arrondis, bouton clair sur fond foncé — toujours éditable via
 * backgroundColor/textColor.
 */

import { TOKENS, solidButtonStyle } from "../design-tokens.js";

const SPACING = { sm: "2rem", md: "3.5rem", lg: "5rem" };
const SPACING_OPTIONS = Object.keys(SPACING).map((value) => ({ label: value, value }));

export const Cta = {
  label: "Appel à l'action",
  fields: {
    title: { type: "text", label: "Titre" },
    text: { type: "textarea", label: "Texte" },
    buttonLabel: { type: "text", label: "Texte du bouton" },
    buttonUrl: { type: "text", label: "Lien du bouton" },
    spacing: { type: "select", label: "Espacement vertical", options: SPACING_OPTIONS },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    title: "Prêt·e à vous lancer ?",
    text: "",
    buttonLabel: "En savoir plus",
    buttonUrl: "#",
    spacing: "md",
    backgroundColor: TOKENS.accent,
    textColor: "#ffffff",
  },
  render: ({ title, text, buttonLabel, buttonUrl, spacing, backgroundColor, textColor }) => {
    const paddingBlock = SPACING[spacing] ?? SPACING.md;
    return (
      <section style={{ padding: `${paddingBlock} 1.5rem`, fontFamily: TOKENS.fontFamily }}>
        <div
          style={{
            "--ssg-cta-bg": backgroundColor || TOKENS.accent,
            "--ssg-cta-fg": textColor || "#ffffff",
            backgroundColor: "var(--ssg-cta-bg)",
            color: "var(--ssg-cta-fg)",
            borderRadius: TOKENS.radius,
            padding: "3rem 2rem",
            textAlign: "center",
            maxWidth: "56rem",
            margin: "0 auto",
          }}
        >
          <div style={{ maxWidth: "36rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {title ? (
              <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>{title}</h2>
            ) : null}
            {text ? (
              <p style={{ fontSize: "1.0625rem", opacity: 0.85, margin: 0, lineHeight: 1.55 }}>{text}</p>
            ) : null}
            {buttonLabel && buttonUrl ? (
              <a
                href={buttonUrl}
                style={{ ...solidButtonStyle("var(--ssg-cta-fg)", "var(--ssg-cta-bg)"), alignSelf: "center", marginTop: "0.5rem" }}
              >
                {buttonLabel}
              </a>
            ) : null}
          </div>
        </div>
      </section>
    );
  },
};
