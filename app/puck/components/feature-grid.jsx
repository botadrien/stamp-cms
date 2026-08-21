/**
 * Composant Puck "FeatureGrid", statique — une grille de fonctionnalités tapées en dur
 * (icône/titre/description), pas de champ binding. Style en custom properties CSS +
 * style inline, pas de Sass.
 *
 * Chaque fonctionnalité rendue en carte (bordure fine + ombre douce + coins arrondis)
 * avec son icône dans un badge rond accent — repris des cartes "Title/Description" de
 * https://demo.puckeditor.com/ (voir app/puck/design-tokens.js).
 */

import { TOKENS } from "../design-tokens.js";

const COLUMNS_OPTIONS = [2, 3, 4].map((value) => ({ label: `${value} colonnes`, value }));
const SPACING = { sm: "2rem", md: "3rem", lg: "4.5rem" };
const SPACING_OPTIONS = Object.keys(SPACING).map((value) => ({ label: value, value }));

export const FeatureGrid = {
  label: "Grille de fonctionnalités",
  fields: {
    title: { type: "text", label: "Titre de la section" },
    columns: { type: "select", label: "Colonnes", options: COLUMNS_OPTIONS },
    spacing: { type: "select", label: "Espacement vertical", options: SPACING_OPTIONS },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
    features: {
      type: "array",
      label: "Fonctionnalités",
      arrayFields: {
        icon: { type: "text", label: "Icône (emoji ou courte étiquette)" },
        title: { type: "text", label: "Titre" },
        description: { type: "textarea", label: "Description" },
      },
      getItemSummary: (item) => item?.title || "Fonctionnalité",
      defaultItemProps: { icon: "✦", title: "Fonctionnalité", description: "" },
    },
  },
  defaultProps: {
    title: "",
    columns: 3,
    spacing: "md",
    backgroundColor: TOKENS.surface,
    textColor: TOKENS.ink,
    features: [
      { icon: "✦", title: "Fonctionnalité", description: "Décrivez la valeur de cette fonctionnalité." },
    ],
  },
  render: ({ title, columns, spacing, backgroundColor, textColor, features }) => {
    const paddingBlock = SPACING[spacing] ?? SPACING.md;
    const items = Array.isArray(features) ? features : [];
    return (
      <section
        style={{
          "--ssg-grid-bg": backgroundColor || TOKENS.surface,
          "--ssg-grid-fg": textColor || TOKENS.ink,
          backgroundColor: "var(--ssg-grid-bg)",
          color: "var(--ssg-grid-fg)",
          padding: `${paddingBlock} 1.5rem`,
          fontFamily: TOKENS.fontFamily,
        }}
      >
        {title ? (
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              textAlign: "center",
              margin: "0 0 2.5rem",
            }}
          >
            {title}
          </h2>
        ) : null}
        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            maxWidth: "72rem",
            margin: "0 auto",
            gridTemplateColumns: `repeat(${columns || 3}, minmax(0, 1fr))`,
          }}
        >
          {items.map((feature, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                padding: "1.75rem",
                borderRadius: TOKENS.radius,
                border: `1px solid ${TOKENS.border}`,
                boxShadow: TOKENS.cardShadow,
                backgroundColor: TOKENS.surface,
              }}
            >
              {feature.icon ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2.75rem",
                    height: "2.75rem",
                    borderRadius: "9999px",
                    backgroundColor: TOKENS.accentSoft,
                    color: TOKENS.accent,
                    fontSize: "1.25rem",
                  }}
                >
                  {feature.icon}
                </span>
              ) : null}
              {feature.title ? (
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: TOKENS.ink }}>{feature.title}</h3>
              ) : null}
              {feature.description ? (
                <p style={{ fontSize: "0.9375rem", color: TOKENS.body, margin: 0, lineHeight: 1.6 }}>
                  {feature.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    );
  },
};
