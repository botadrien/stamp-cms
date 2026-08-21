/**
 * Composant Puck "Accordion" — volet repliable (titre toujours visible + corps richtext
 * masqué/affiché), même idée que le bloc "Details" de Gutenberg, le "toggle" de Notion ou
 * l'Accordéon de gouvfr-docs/DSFR. Basé sur `<details>/<summary>` natifs plutôt que du JS
 * (pas de useState : chaque instance garde son propre état d'ouverture navigateur, aucun
 * intérêt à le piloter depuis React ici). `body` réutilise le champ natif `type:
 * "richtext"` (voir rich-text.jsx) et la classe `.ssg-prose` — le `<style>{PROSE_CSS}</style>`
 * n'est injecté qu'une fois par page par ContentSlot (content-slot.jsx), pas ici, même
 * principe que RichText qui se contente lui aussi de porter la classe sans réinjecter le
 * style. Statique par ailleurs (pas de champ binding), comme Hero/Cta/FeatureGrid (voir
 * leurs docstrings). Enregistré à la fois dans la palette complète
 * (app/puck/registry.jsx) et dans la Config restreinte de l'éditeur de contenu
 * (editor-src/puck-content-editor.jsx), voir callout.jsx pour l'explication.
 */

import { TOKENS } from "../design-tokens.js";

const BOOL_OPTIONS = [
  { label: "Oui", value: true },
  { label: "Non", value: false },
];

export const Accordion = {
  label: "Accordéon",
  fields: {
    summary: { type: "text", label: "Titre (visible replié)" },
    body: { type: "richtext" },
    open: { type: "radio", label: "Ouvert par défaut", options: BOOL_OPTIONS },
  },
  defaultProps: {
    summary: "Titre",
    body: "",
    open: false,
  },
  render: ({ summary, body, open }) => (
    <details
      open={open}
      style={{
        margin: "1.5rem 0",
        padding: "1rem 1.25rem",
        border: `1px solid ${TOKENS.border}`,
        borderRadius: TOKENS.radiusSm,
        fontFamily: TOKENS.fontFamily,
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 700, color: TOKENS.ink, fontSize: "1.0625rem" }}>
        {summary}
      </summary>
      {body ? (
        <div className="ssg-prose" style={{ marginTop: "0.875rem", fontSize: "1.0625rem" }}>
          {body}
        </div>
      ) : null}
    </details>
  ),
};
