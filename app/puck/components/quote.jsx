/**
 * Composant Puck "Quote" — citation avec auteur·ice/source, même idée que le bloc "Quote"
 * de Gutenberg ou le composant "Citation" de gouvfr-docs. Statique, aucun champ binding —
 * comme Hero/Cta/FeatureGrid (voir leurs docstrings). Enregistré à la fois dans la palette
 * complète (app/puck/registry.jsx) et dans la Config restreinte de l'éditeur de contenu
 * (editor-src/puck-content-editor.jsx), voir callout.jsx pour l'explication.
 */

import { TOKENS } from "../design-tokens.js";

export const Quote = {
  label: "Citation",
  fields: {
    quote: { type: "textarea", label: "Citation" },
    author: { type: "text", label: "Auteur·ice" },
    role: { type: "text", label: "Fonction / source" },
  },
  defaultProps: {
    quote: "",
    author: "",
    role: "",
  },
  render: ({ quote, author, role }) => {
    if (!quote) return null;
    return (
      <blockquote
        style={{
          margin: "1.5rem 0",
          padding: "0.25rem 0 0.25rem 1.25rem",
          borderLeft: `3px solid ${TOKENS.accent}`,
          fontFamily: TOKENS.fontFamily,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "1.1875rem",
            fontStyle: "italic",
            color: TOKENS.ink,
            lineHeight: 1.55,
          }}
        >
          {quote}
        </p>
        {author || role ? (
          <footer style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: TOKENS.muted }}>
            {author ? <span style={{ fontWeight: 700, color: TOKENS.body }}>{author}</span> : null}
            {author && role ? " — " : null}
            {role}
          </footer>
        ) : null}
      </blockquote>
    );
  },
};
