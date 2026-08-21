/**
 * Composant Puck "ArticleTeaser" — pensé pour vivre dans le slot d'un Repeater
 * (app/puck/components/repeater.jsx), pas pour être utilisé seul. Contrairement à
 * ArticleCard (qui boucle lui-même sur une collection entière), chaque champ ici est
 * bindé sur l'item courant (`item.title`, `item.date`, `item.excerpt`, `item.url`) —
 * c'est le Repeater qui fournit cet `item` via son Context scoped par itération.
 */

import { bindingField } from "../fields/binding-field.jsx";
import { resolveProps } from "../resolver.js";
import { useSsgContext } from "../ssg-context.js";
import { resolveHref } from "../../ssg/context.js";
import { TOKENS } from "../design-tokens.js";

const ITEM_FIELD = (label, path) => bindingField({ label, paths: [path], allowCollection: false });

export const ArticleTeaser = {
  label: "Extrait d'article (item du Répéteur)",
  fields: {
    title: ITEM_FIELD("Titre", "item.title"),
    date: ITEM_FIELD("Date", "item.date"),
    excerpt: ITEM_FIELD("Extrait", "item.excerpt"),
    url: ITEM_FIELD("Lien", "item.url"),
    accentColor: { type: "text", label: "Couleur d'accent (hex)" },
  },
  defaultProps: {
    title: { $bind: "item.title" },
    date: { $bind: "item.date" },
    excerpt: { $bind: "item.excerpt" },
    url: { $bind: "item.url" },
    accentColor: TOKENS.accent,
  },
  render: ({ title, date, excerpt, url, accentColor }) => {
    const context = useSsgContext();
    const resolved = resolveProps({ title, date, excerpt, url }, context);
    return (
      <a
        href={resolved.url ? resolveHref(context, resolved.url) : "#"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          padding: "1.5rem",
          maxWidth: "48rem",
          margin: "0 auto 1.25rem",
          borderRadius: TOKENS.radius,
          border: `1px solid ${TOKENS.border}`,
          boxShadow: TOKENS.cardShadow,
          backgroundColor: TOKENS.surface,
          color: "inherit",
          textDecoration: "none",
          fontFamily: TOKENS.fontFamily,
        }}
      >
        {resolved.date ? (
          <span
            style={{
              fontSize: "0.8125rem",
              color: accentColor || TOKENS.accent,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {resolved.date}
          </span>
        ) : null}
        {resolved.title ? (
          <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: TOKENS.ink }}>{resolved.title}</h3>
        ) : null}
        {resolved.excerpt ? (
          <p style={{ fontSize: "0.9375rem", color: TOKENS.body, margin: 0, lineHeight: 1.55 }}>{resolved.excerpt}</p>
        ) : null}
      </a>
    );
  },
};
