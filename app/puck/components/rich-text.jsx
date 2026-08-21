/**
 * Composant Puck "RichText" — un bloc de texte formaté (gras, titres, listes,
 * citation...), édité via le champ natif `type: "richtext"` de @puckeditor/core (Tiptap
 * embarqué). Remplace l'ancien éditeur BlockNote : chaque article/page a désormais son
 * propre petit arbre Puck (voir ContentSlot, content-slot.jsx) dont le corps est composé
 * d'un ou plusieurs blocs `RichText`.
 *
 * `body` : Puck enveloppe automatiquement tout champ `type:"richtext"` avant que
 * render() ne le reçoive (voir @puckeditor/core, `useRichtextProps`) — c'est déjà un
 * ReactNode prêt à afficher, pas une string HTML à repasser dans
 * dangerouslySetInnerHTML.
 */

import { TOKENS } from "../design-tokens.js";

export const PROSE_CSS = `
.ssg-prose { color: ${TOKENS.body}; }
.ssg-prose > * + * { margin-top: 1.25em; }
.ssg-prose h2 { font-size: 1.5rem; font-weight: 700; color: ${TOKENS.ink}; margin-top: 2em; letter-spacing: -0.01em; }
.ssg-prose h3 { font-size: 1.1875rem; font-weight: 700; color: ${TOKENS.ink}; margin-top: 1.75em; }
.ssg-prose a { color: ${TOKENS.accent}; text-decoration: underline; text-underline-offset: 0.15em; }
.ssg-prose strong { color: ${TOKENS.ink}; font-weight: 700; }
.ssg-prose ul, .ssg-prose ol { padding-left: 1.375em; }
.ssg-prose li + li { margin-top: 0.4em; }
.ssg-prose blockquote { border-left: 3px solid ${TOKENS.border}; margin-left: 0; padding-left: 1.25em; color: ${TOKENS.muted}; font-style: italic; }
.ssg-prose code { background: ${TOKENS.surfaceAlt}; border-radius: 0.25rem; padding: 0.15em 0.4em; font-size: 0.875em; }
.ssg-prose pre { background: ${TOKENS.ink}; color: #f4f4f5; border-radius: ${TOKENS.radiusSm}; padding: 1.25em; overflow-x: auto; }
.ssg-prose pre code { background: none; padding: 0; }
.ssg-prose img { max-width: 100%; border-radius: ${TOKENS.radiusSm}; }
`;

export const RichText = {
  label: "Texte",
  fields: {
    body: { type: "richtext" },
  },
  defaultProps: {
    body: "",
  },
  render: ({ body }) => (
    <div className="ssg-prose" style={{ lineHeight: 1.7, fontSize: "1.0625rem" }}>
      {body}
    </div>
  ),
};
