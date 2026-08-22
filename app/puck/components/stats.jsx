/**
 * Composant Puck "Stats" — grille de chiffres clés (grand nombre + légende), ex. chiffres
 * d'impact d'une association ("12M+ litres fournis") ou métriques SaaS. Distinct de
 * FeatureGrid (icône + titre + description) : ici la valeur mise en avant est le nombre
 * lui-même, pas une description. Statique, aucun champ binding — comme Hero/Cta/FeatureGrid
 * (voir leurs docstrings). Enregistré uniquement dans la palette complète
 * (app/puck/registry.jsx) : section de mise en page, pas un bloc de corps d'article.
 */

import { TOKENS, cssVar } from "../design-tokens.js";

const COLUMNS_OPTIONS = [2, 3, 4].map((value) => ({ label: `${value} colonnes`, value }));

export const Stats = {
  label: "Chiffres clés",
  fields: {
    title: { type: "text", label: "Titre (optionnel)" },
    columns: { type: "select", label: "Colonnes", options: COLUMNS_OPTIONS },
    stats: {
      type: "array",
      label: "Statistiques",
      arrayFields: {
        value: { type: "text", label: "Chiffre (ex. 12M+)" },
        label: { type: "text", label: "Légende" },
      },
      getItemSummary: (item) => item?.value || "Statistique",
      defaultItemProps: { value: "0", label: "Légende" },
    },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    title: "",
    columns: 3,
    stats: [{ value: "0", label: "Légende" }],
    backgroundColor: TOKENS.surfaceAlt,
    textColor: TOKENS.ink,
  },
  render: ({ title, columns, stats, backgroundColor, textColor }) => {
    const items = Array.isArray(stats) ? stats : [];
    return (
      <section
        style={{
          "--ssg-stats-bg": backgroundColor || TOKENS.surfaceAlt,
          "--ssg-stats-fg": textColor || TOKENS.ink,
          backgroundColor: "var(--ssg-stats-bg)",
          color: "var(--ssg-stats-fg)",
          padding: "3.5rem 1.5rem",
          fontFamily: cssVar("fontFamily"),
        }}
      >
        {title ? (
          <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.01em", textAlign: "center", margin: "0 0 2.5rem" }}>
            {title}
          </h2>
        ) : null}
        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            maxWidth: "64rem",
            margin: "0 auto",
            gridTemplateColumns: `repeat(${columns || 3}, minmax(0, 1fr))`,
            textAlign: "center",
          }}
        >
          {items.map((stat, index) => (
            <div key={index}>
              <p style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: cssVar("accent") }}>
                {stat.value}
              </p>
              {stat.label ? <p style={{ margin: "0.375rem 0 0", opacity: 0.75, fontSize: "0.9375rem" }}>{stat.label}</p> : null}
            </div>
          ))}
        </div>
      </section>
    );
  },
};
