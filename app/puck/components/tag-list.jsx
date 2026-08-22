/**
 * Composant Puck "TagList" — pastilles d'étiquettes affichées en tête d'article (ex.
 * thème du blog "devblog"). Purement déclaratif, saisi à la main dans le corps de
 * l'article comme n'importe quel autre bloc de contenu (RichText, Callout...) : pas de
 * route d'index par étiquette ni de filtrage (hors scope, aucun routage de ce type
 * n'existe dans le renderer). Statique, aucun champ binding — comme Hero/Cta/FeatureGrid
 * (voir leurs docstrings). Enregistré à la fois dans la palette complète
 * (app/puck/registry.jsx) et dans la Config restreinte de l'éditeur de contenu
 * (editor-src/puck-content-editor.jsx), voir callout.jsx pour l'explication.
 */

import { cssVar } from "../design-tokens.js";

export const TagList = {
  label: "Étiquettes",
  fields: {
    tags: {
      type: "array",
      label: "Étiquettes",
      arrayFields: {
        label: { type: "text", label: "Étiquette" },
      },
      getItemSummary: (item) => item?.label || "Étiquette",
      defaultItemProps: { label: "étiquette" },
    },
  },
  defaultProps: {
    tags: [{ label: "étiquette" }],
  },
  render: ({ tags }) => {
    const items = (Array.isArray(tags) ? tags : []).filter((tag) => tag?.label);
    if (items.length === 0) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "0 0 1.25rem" }}>
        {items.map((tag, index) => (
          <span
            key={index}
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              backgroundColor: cssVar("accentSoft"),
              color: cssVar("accent"),
              fontFamily: cssVar("fontFamily"),
            }}
          >
            {tag.label}
          </span>
        ))}
      </div>
    );
  },
};
