/**
 * Composant Puck "Image" — comble le manque documenté dans README ("Points à trancher") :
 * aucun bloc image n'existait dans la palette. URL uniquement (pas d'upload : aucune
 * gestion de médias dans le dépôt n'existe dans ce projet, voir feuille de route README) —
 * pointe vers une image déjà hébergée ailleurs (CDN, Unsplash, etc.). Statique, aucun
 * champ binding — comme Hero/Cta/FeatureGrid (voir leurs docstrings). Enregistré à la fois
 * dans la palette complète (app/puck/registry.jsx) et dans la Config restreinte de
 * l'éditeur de contenu (editor-src/puck-content-editor.jsx), voir callout.jsx pour
 * l'explication.
 */

import { cssVar } from "../design-tokens.js";

const BOOL_OPTIONS = [
  { label: "Oui", value: true },
  { label: "Non", value: false },
];

export const Image = {
  label: "Image",
  fields: {
    src: { type: "text", label: "URL de l'image" },
    alt: { type: "text", label: "Texte alternatif" },
    caption: { type: "text", label: "Légende (optionnel)" },
    rounded: { type: "radio", label: "Coins arrondis", options: BOOL_OPTIONS },
  },
  defaultProps: {
    src: "",
    alt: "",
    caption: "",
    rounded: true,
  },
  render: ({ src, alt, caption, rounded }) => {
    if (!src) return null;
    return (
      <figure style={{ margin: "1.5rem 0" }}>
        <img
          src={src}
          alt={alt || ""}
          loading="lazy"
          style={{
            display: "block",
            maxWidth: "100%",
            height: "auto",
            borderRadius: rounded ? cssVar("radiusSm") : 0,
          }}
        />
        {caption ? (
          <figcaption style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: cssVar("muted"), fontFamily: cssVar("fontFamily") }}>
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
  },
};
