/**
 * Composant Puck "Divider" — simple séparateur horizontal, même idée que le bloc
 * "Separator" de Gutenberg ou le diviseur de Notion. Statique, aucun champ binding —
 * comme Hero/Cta/FeatureGrid (voir leurs docstrings). Enregistré à la fois dans la
 * palette complète (app/puck/registry.jsx) et dans la Config restreinte de l'éditeur de
 * contenu (editor-src/puck-content-editor.jsx), voir callout.jsx pour l'explication.
 */

import { cssVar } from "../design-tokens.js";

const SPACING = { sm: "1.5rem", md: "2.5rem", lg: "4rem" };
const SPACING_OPTIONS = Object.keys(SPACING).map((value) => ({ label: value, value }));

export const Divider = {
  label: "Séparateur",
  fields: {
    spacing: { type: "select", label: "Espacement vertical", options: SPACING_OPTIONS },
  },
  defaultProps: {
    spacing: "md",
  },
  render: ({ spacing }) => {
    const margin = SPACING[spacing] ?? SPACING.md;
    return <hr style={{ border: "none", borderTop: `1px solid ${cssVar("border")}`, margin: `${margin} 0` }} />;
  },
};
