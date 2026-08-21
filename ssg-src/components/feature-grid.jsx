/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "FeatureGrid", statique — une
 * grille de fonctionnalités tapées en dur (icône/titre/description), pas de champ
 * binding. Style en custom properties CSS + style inline, pas de Sass.
 */

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
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
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
          "--ssg-grid-bg": backgroundColor || "#ffffff",
          "--ssg-grid-fg": textColor || "#0f172a",
          backgroundColor: "var(--ssg-grid-bg)",
          color: "var(--ssg-grid-fg)",
          padding: `${paddingBlock} 1.5rem`,
        }}
      >
        {title ? (
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, textAlign: "center", margin: "0 0 2rem" }}>{title}</h2>
        ) : null}
        <div
          style={{
            display: "grid",
            gap: "2rem",
            maxWidth: "72rem",
            margin: "0 auto",
            gridTemplateColumns: `repeat(${columns || 3}, minmax(0, 1fr))`,
          }}
        >
          {items.map((feature, index) => (
            <div key={index} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {feature.icon ? <span style={{ fontSize: "1.75rem" }}>{feature.icon}</span> : null}
              {feature.title ? <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>{feature.title}</h3> : null}
              {feature.description ? (
                <p style={{ fontSize: "0.9375rem", opacity: 0.85, margin: 0, lineHeight: 1.5 }}>{feature.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    );
  },
};
