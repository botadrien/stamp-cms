/**
 * Composant Puck "Space" — espaceur vertical pur, même idée que le bloc "Spacer" de
 * Gutenberg. Statique, aucun champ binding — comme Hero/Cta/FeatureGrid (voir leurs
 * docstrings). Enregistré à la fois dans la palette complète (app/puck/registry.jsx) et
 * dans la Config restreinte de l'éditeur de contenu (editor-src/puck-content-editor.jsx),
 * voir callout.jsx pour l'explication.
 */

const HEIGHTS = { sm: "1.5rem", md: "3rem", lg: "5rem", xl: "8rem" };
const HEIGHT_OPTIONS = Object.keys(HEIGHTS).map((value) => ({ label: value, value }));

export const Space = {
  label: "Espace",
  fields: {
    height: { type: "select", label: "Hauteur", options: HEIGHT_OPTIONS },
  },
  defaultProps: {
    height: "md",
  },
  render: ({ height }) => <div style={{ height: HEIGHTS[height] ?? HEIGHTS.md }} aria-hidden="true" />,
};
