/**
 * Composant Puck "LogoCloud" — rangée de logos partenaires/clients/financeurs (ex.
 * "Ils nous font confiance" sur une landing SaaS, bailleurs sur une page d'association).
 * Statique, aucun champ binding — comme Hero/Cta/FeatureGrid (voir leurs docstrings).
 * Enregistré uniquement dans la palette complète (app/puck/registry.jsx) : section de mise
 * en page, pas un bloc de corps d'article.
 */

import { cssVar } from "../design-tokens.js";

export const LogoCloud = {
  label: "Logos partenaires",
  fields: {
    title: { type: "text", label: "Titre (optionnel)" },
    logos: {
      type: "array",
      label: "Logos",
      arrayFields: {
        imageUrl: { type: "text", label: "URL du logo" },
        alt: { type: "text", label: "Nom" },
        linkUrl: { type: "text", label: "Lien (optionnel)" },
      },
      getItemSummary: (item) => item?.alt || "Logo",
      defaultItemProps: { imageUrl: "", alt: "", linkUrl: "" },
    },
  },
  defaultProps: {
    title: "",
    logos: [],
  },
  render: ({ title, logos }) => {
    const items = (Array.isArray(logos) ? logos : []).filter((logo) => logo?.imageUrl);
    if (items.length === 0) return null;
    return (
      <section style={{ padding: "2.5rem 1.5rem", fontFamily: cssVar("fontFamily") }}>
        {title ? (
          <p
            style={{
              textAlign: "center",
              fontSize: "0.8125rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: cssVar("muted"),
              margin: "0 0 1.75rem",
            }}
          >
            {title}
          </p>
        ) : null}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "2.5rem",
            maxWidth: "64rem",
            margin: "0 auto",
          }}
        >
          {items.map((logo, index) => {
            const img = (
              <img
                src={logo.imageUrl}
                alt={logo.alt || ""}
                style={{ height: "2rem", width: "auto", opacity: 0.7, filter: "grayscale(1)" }}
              />
            );
            return logo.linkUrl ? (
              <a key={index} href={logo.linkUrl}>
                {img}
              </a>
            ) : (
              <span key={index}>{img}</span>
            );
          })}
        </div>
      </section>
    );
  },
};
