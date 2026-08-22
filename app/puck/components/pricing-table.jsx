/**
 * Composant Puck "PricingTable" — grille de formules tarifaires (SaaS). `features` est un
 * textarea (une fonctionnalité par ligne) plutôt qu'un array Puck imbriqué : plus simple à
 * remplir pour une liste de 2-3 lignes que trois niveaux de tiroir Puck (formules > item >
 * fonctionnalités > item). Statique, aucun champ binding — comme Hero/Cta/FeatureGrid (voir
 * leurs docstrings). Enregistré uniquement dans la palette complète
 * (app/puck/registry.jsx) : section de mise en page, pas un bloc de corps d'article.
 */

import { cssVar, solidButtonStyle } from "../design-tokens.js";

const BOOL_OPTIONS = [
  { label: "Oui", value: true },
  { label: "Non", value: false },
];

export const PricingTable = {
  label: "Grille tarifaire",
  fields: {
    title: { type: "text", label: "Titre (optionnel)" },
    tiers: {
      type: "array",
      label: "Formules",
      arrayFields: {
        name: { type: "text", label: "Nom" },
        price: { type: "text", label: "Prix (ex. 19€)" },
        period: { type: "text", label: "Période (ex. /mois)" },
        features: { type: "textarea", label: "Fonctionnalités (une par ligne)" },
        ctaLabel: { type: "text", label: "Texte du bouton" },
        ctaUrl: { type: "text", label: "Lien du bouton" },
        featured: { type: "radio", label: "Mise en avant", options: BOOL_OPTIONS },
      },
      getItemSummary: (item) => item?.name || "Formule",
      defaultItemProps: {
        name: "Formule",
        price: "0€",
        period: "/mois",
        features: "",
        ctaLabel: "Choisir",
        ctaUrl: "#",
        featured: false,
      },
    },
  },
  defaultProps: {
    title: "",
    tiers: [],
  },
  render: ({ title, tiers }) => {
    const items = Array.isArray(tiers) ? tiers : [];
    if (items.length === 0) return null;
    return (
      <section style={{ padding: "3.5rem 1.5rem", fontFamily: cssVar("fontFamily") }}>
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
            gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          }}
        >
          {items.map((tier, index) => {
            const features = (tier.features || "").split("\n").map((line) => line.trim()).filter(Boolean);
            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  padding: "2rem 1.75rem",
                  borderRadius: cssVar("radius"),
                  border: tier.featured ? `2px solid ${cssVar("accent")}` : `1px solid ${cssVar("border")}`,
                  boxShadow: cssVar("cardShadow"),
                  backgroundColor: cssVar("surface"),
                }}
              >
                {tier.name ? <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: cssVar("ink") }}>{tier.name}</h3> : null}
                <p style={{ margin: 0 }}>
                  <span style={{ fontSize: "2.25rem", fontWeight: 800, color: cssVar("ink") }}>{tier.price}</span>
                  {tier.period ? <span style={{ fontSize: "0.9375rem", opacity: 0.65 }}> {tier.period}</span> : null}
                </p>
                {features.length > 0 ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {features.map((feature, featureIndex) => (
                      <li key={featureIndex} style={{ fontSize: "0.9375rem", color: cssVar("body") }}>
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {tier.ctaLabel && tier.ctaUrl ? (
                  <a
                    href={tier.ctaUrl}
                    style={
                      tier.featured
                        ? { ...solidButtonStyle(cssVar("accent"), "#ffffff"), textAlign: "center" }
                        : { ...solidButtonStyle("transparent", cssVar("ink")), textAlign: "center", border: `1px solid ${cssVar("border")}` }
                    }
                  >
                    {tier.ctaLabel}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    );
  },
};
