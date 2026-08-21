/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "Hero", statique — texte tapé
 * en dur par l'auteur·ice, pas de champ binding (voir la brief Track D : les
 * composants statiques hero/CTA/grille n'ont besoin de rien d'autre). Style en
 * custom properties CSS + style inline, pas de Sass.
 */

const ALIGN_OPTIONS = [
  { label: "Aligné à gauche", value: "left" },
  { label: "Centré", value: "center" },
];

const SPACING = { sm: "2.5rem", md: "4rem", lg: "6rem" };
const SPACING_OPTIONS = Object.keys(SPACING).map((value) => ({ label: value, value }));

export const Hero = {
  label: "Hero",
  fields: {
    eyebrow: { type: "text", label: "Accroche (au-dessus du titre)" },
    title: { type: "text", label: "Titre" },
    subtitle: { type: "textarea", label: "Sous-titre" },
    ctaLabel: { type: "text", label: "Texte du bouton" },
    ctaUrl: { type: "text", label: "Lien du bouton" },
    align: { type: "select", label: "Alignement", options: ALIGN_OPTIONS },
    spacing: { type: "select", label: "Espacement vertical", options: SPACING_OPTIONS },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    eyebrow: "",
    title: "Titre de la page",
    subtitle: "",
    ctaLabel: "",
    ctaUrl: "",
    align: "left",
    spacing: "md",
    backgroundColor: "#0f172a",
    textColor: "#f8fafc",
  },
  render: ({ eyebrow, title, subtitle, ctaLabel, ctaUrl, align, spacing, backgroundColor, textColor }) => {
    const paddingBlock = SPACING[spacing] ?? SPACING.md;
    const centered = align === "center";
    return (
      <section
        style={{
          "--ssg-hero-bg": backgroundColor || "#0f172a",
          "--ssg-hero-fg": textColor || "#f8fafc",
          backgroundColor: "var(--ssg-hero-bg)",
          color: "var(--ssg-hero-fg)",
          padding: `${paddingBlock} 1.5rem`,
          textAlign: centered ? "center" : "left",
        }}
      >
        <div style={{ maxWidth: "48rem", margin: centered ? "0 auto" : "0" }}>
          {eyebrow ? (
            <p
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.75,
                margin: "0 0 0.75rem",
              }}
            >
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 700, margin: "0 0 1rem", lineHeight: 1.1 }}>
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p style={{ fontSize: "1.125rem", opacity: 0.9, margin: "0 0 1.5rem", lineHeight: 1.5 }}>{subtitle}</p>
          ) : null}
          {ctaLabel && ctaUrl ? (
            <a
              href={ctaUrl}
              style={{
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                backgroundColor: "var(--ssg-hero-fg)",
                color: "var(--ssg-hero-bg)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </section>
    );
  },
};
