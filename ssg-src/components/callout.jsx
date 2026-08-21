/**
 * Composant Puck "Callout" — encart de mise en avant (icône + texte sur fond teinté),
 * même idée que le bloc "Callout" de Notion ou les encarts d'alerte de gouvfr-docs/DSFR.
 * Statique, aucun champ binding — comme Hero/Cta/FeatureGrid (voir leurs docstrings).
 * Enregistré à la fois dans la palette complète (ssg-src/registry.jsx, éditeur de mise en
 * page + renderer de publication) et dans la Config restreinte de l'éditeur de contenu
 * (editor-src/puck-content-editor.jsx) : ce bloc, comme RichText, fait partie du corps
 * d'une page/d'un article, pas de sa mise en page (nav/hero/footer).
 */

import { TOKENS } from "../design-tokens.js";

// Palette locale (pas dans design-tokens.js, comme SPACING dans hero.jsx/cta.jsx) :
// TOKENS n'a qu'un seul accent (bleu) — un encart a besoin de plusieurs tons distincts
// (succès/avertissement/danger) en plus de l'info, alignés sur l'accent existant pour
// le ton "info".
const TONES = {
  info: { bg: "#eff6ff", border: "#bfdbfe", fg: TOKENS.accent },
  success: { bg: "#f0fdf4", border: "#bbf7d0", fg: "#15803d" },
  warning: { bg: "#fffbeb", border: "#fde68a", fg: "#b45309" },
  danger: { bg: "#fef2f2", border: "#fecaca", fg: "#b91c1c" },
};

const TONE_OPTIONS = [
  { label: "Info", value: "info" },
  { label: "Succès", value: "success" },
  { label: "Avertissement", value: "warning" },
  { label: "Danger", value: "danger" },
];

export const Callout = {
  label: "Encart",
  fields: {
    icon: { type: "text", label: "Icône (emoji)" },
    title: { type: "text", label: "Titre" },
    text: { type: "textarea", label: "Texte" },
    tone: { type: "select", label: "Ton", options: TONE_OPTIONS },
  },
  defaultProps: {
    icon: "💡",
    title: "",
    text: "",
    tone: "info",
  },
  render: ({ icon, title, text, tone }) => {
    const palette = TONES[tone] ?? TONES.info;
    return (
      <div
        style={{
          display: "flex",
          gap: "0.875rem",
          margin: "1.5rem 0",
          padding: "1.125rem 1.25rem",
          borderRadius: TOKENS.radiusSm,
          border: `1px solid ${palette.border}`,
          backgroundColor: palette.bg,
          fontFamily: TOKENS.fontFamily,
        }}
      >
        {icon ? (
          <span style={{ fontSize: "1.25rem", lineHeight: 1.5 }} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {title ? (
            <p style={{ margin: 0, fontWeight: 700, color: palette.fg, fontSize: "1rem" }}>{title}</p>
          ) : null}
          {text ? (
            <p style={{ margin: 0, color: TOKENS.body, fontSize: "0.9375rem", lineHeight: 1.6 }}>{text}</p>
          ) : null}
        </div>
      </div>
    );
  },
};
