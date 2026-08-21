/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "Cta" (appel à l'action),
 * statique — pas de champ binding. Style en custom properties CSS + style inline,
 * pas de Sass.
 */

const SPACING = { sm: "2rem", md: "3.5rem", lg: "5rem" };
const SPACING_OPTIONS = Object.keys(SPACING).map((value) => ({ label: value, value }));

export const Cta = {
  label: "Appel à l'action",
  fields: {
    title: { type: "text", label: "Titre" },
    text: { type: "textarea", label: "Texte" },
    buttonLabel: { type: "text", label: "Texte du bouton" },
    buttonUrl: { type: "text", label: "Lien du bouton" },
    spacing: { type: "select", label: "Espacement vertical", options: SPACING_OPTIONS },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    title: "Prêt·e à vous lancer ?",
    text: "",
    buttonLabel: "En savoir plus",
    buttonUrl: "#",
    spacing: "md",
    backgroundColor: "#2563eb",
    textColor: "#ffffff",
  },
  render: ({ title, text, buttonLabel, buttonUrl, spacing, backgroundColor, textColor }) => {
    const paddingBlock = SPACING[spacing] ?? SPACING.md;
    return (
      <section
        style={{
          "--ssg-cta-bg": backgroundColor || "#2563eb",
          "--ssg-cta-fg": textColor || "#ffffff",
          backgroundColor: "var(--ssg-cta-bg)",
          color: "var(--ssg-cta-fg)",
          padding: `${paddingBlock} 1.5rem`,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "36rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {title ? <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{title}</h2> : null}
          {text ? <p style={{ fontSize: "1rem", opacity: 0.9, margin: 0, lineHeight: 1.5 }}>{text}</p> : null}
          {buttonLabel && buttonUrl ? (
            <a
              href={buttonUrl}
              style={{
                alignSelf: "center",
                display: "inline-block",
                padding: "0.75rem 1.75rem",
                borderRadius: "0.5rem",
                backgroundColor: "var(--ssg-cta-fg)",
                color: "var(--ssg-cta-bg)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {buttonLabel}
            </a>
          ) : null}
        </div>
      </section>
    );
  },
};
