/**
 * Composant Puck "Testimonial" — citation client/bénéficiaire en carte pleine largeur
 * (avatar + citation + nom/fonction), pour une section de page d'accueil (landing SaaS,
 * association). Distinct de Quote (app/puck/components/quote.jsx), qui reste un petit bloc
 * de corps de page — pas la même mise en page ni le même contexte d'usage. Statique,
 * aucun champ binding — comme Hero/Cta/FeatureGrid (voir leurs docstrings). Enregistré
 * uniquement dans la palette complète (app/puck/registry.jsx) : section de mise en page,
 * pas un bloc de corps d'article.
 */

import { TOKENS, cssVar } from "../design-tokens.js";

export const Testimonial = {
  label: "Témoignage",
  fields: {
    quote: { type: "textarea", label: "Citation" },
    name: { type: "text", label: "Nom" },
    role: { type: "text", label: "Fonction / entreprise" },
    avatarUrl: { type: "text", label: "URL de l'avatar (optionnel)" },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    quote: "",
    name: "",
    role: "",
    avatarUrl: "",
    backgroundColor: TOKENS.surfaceAlt,
    textColor: TOKENS.ink,
  },
  render: ({ quote, name, role, avatarUrl, backgroundColor, textColor }) => {
    if (!quote) return null;
    return (
      <section
        style={{
          "--ssg-testimonial-bg": backgroundColor || TOKENS.surfaceAlt,
          "--ssg-testimonial-fg": textColor || TOKENS.ink,
          backgroundColor: "var(--ssg-testimonial-bg)",
          color: "var(--ssg-testimonial-fg)",
          padding: "3.5rem 1.5rem",
          fontFamily: cssVar("fontFamily"),
        }}
      >
        <div
          style={{
            maxWidth: "36rem",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.25rem",
            textAlign: "center",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "3.5rem", height: "3.5rem", borderRadius: "9999px", objectFit: "cover" }}
            />
          ) : null}
          <p style={{ fontSize: "1.25rem", fontStyle: "italic", lineHeight: 1.55, margin: 0 }}>{quote}</p>
          {name || role ? (
            <div style={{ fontSize: "0.9375rem" }}>
              {name ? <span style={{ fontWeight: 700 }}>{name}</span> : null}
              {name && role ? " — " : null}
              {role ? <span style={{ opacity: 0.72 }}>{role}</span> : null}
            </div>
          ) : null}
        </div>
      </section>
    );
  },
};
