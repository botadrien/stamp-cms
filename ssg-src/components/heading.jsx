/**
 * Composant Puck "Heading" — titre de section autonome (H2/H3/H4), même idée que le bloc
 * "Heading" de Gutenberg ou de Notion. Distinct du H2/H3 déjà atteignables *à l'intérieur*
 * d'un champ richtext (voir PROSE_CSS, rich-text.jsx) : utile quand l'auteur·ice veut un
 * titre comme bloc à part entière (ex. juste avant un Callout/CodeBlock, hors d'un pavé de
 * texte). Statique, aucun champ binding — comme Hero/Cta/FeatureGrid (voir leurs
 * docstrings). Enregistré à la fois dans la palette complète (ssg-src/registry.jsx) et
 * dans la Config restreinte de l'éditeur de contenu (editor-src/puck-content-editor.jsx),
 * voir callout.jsx pour l'explication.
 */

import { TOKENS } from "../design-tokens.js";

const LEVELS = {
  h2: { tag: "h2", fontSize: "1.5rem", margin: "1.75rem 0 0.75rem" },
  h3: { tag: "h3", fontSize: "1.1875rem", margin: "1.5rem 0 0.5rem" },
  h4: { tag: "h4", fontSize: "1.0625rem", margin: "1.25rem 0 0.5rem" },
};

const LEVEL_OPTIONS = [
  { label: "Titre 2 (H2)", value: "h2" },
  { label: "Titre 3 (H3)", value: "h3" },
  { label: "Titre 4 (H4)", value: "h4" },
];

const ALIGN_OPTIONS = [
  { label: "Aligné à gauche", value: "left" },
  { label: "Centré", value: "center" },
];

export const Heading = {
  label: "Titre",
  fields: {
    text: { type: "text", label: "Texte" },
    level: { type: "select", label: "Niveau", options: LEVEL_OPTIONS },
    align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
  },
  defaultProps: {
    text: "Titre de section",
    level: "h2",
    align: "left",
  },
  render: ({ text, level, align }) => {
    if (!text) return null;
    const { tag: Tag, fontSize, margin } = LEVELS[level] ?? LEVELS.h2;
    return (
      <Tag
        style={{
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: TOKENS.ink,
          fontFamily: TOKENS.fontFamily,
          margin,
          textAlign: align === "center" ? "center" : "left",
        }}
      >
        {text}
      </Tag>
    );
  },
};
