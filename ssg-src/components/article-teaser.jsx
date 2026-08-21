/**
 * Phase 2 (intégration, voir docs/plan-puck-ssg.md, "Point de contrôle prototype") :
 * composant Puck "ArticleTeaser" — pensé pour vivre dans le slot d'un Repeater
 * (ssg-src/components/repeater.jsx), pas pour être utilisé seul. Contrairement à
 * ArticleCard (qui boucle lui-même sur une collection entière), chaque champ ici est
 * bindé sur l'item courant (`item.title`, `item.date`, `item.excerpt`, `item.url`) —
 * c'est le Repeater qui fournit cet `item` via son Context scoped par itération. Sert
 * de brique minimale pour valider bout en bout "Repeater + bindings + collections"
 * (tâche 10 du plan), la palette ne contenant encore aucun composant bindable au
 * niveau item avant celui-ci.
 */

import { bindingField } from "../fields/binding-field.jsx";
import { resolveProps } from "../resolver.js";
import { useSsgContext } from "../ssg-context.js";

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
    accentColor: "#2563eb",
  },
  render: ({ title, date, excerpt, url, accentColor }) => {
    const context = useSsgContext();
    const resolved = resolveProps({ title, date, excerpt, url }, context);
    return (
      <a
        href={resolved.url || "#"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          padding: "1.25rem",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          color: "inherit",
          textDecoration: "none",
        }}
      >
        {resolved.date ? (
          <span style={{ fontSize: "0.8125rem", color: accentColor || "#2563eb", fontWeight: 600 }}>
            {resolved.date}
          </span>
        ) : null}
        {resolved.title ? <h3 style={{ fontSize: "1.0625rem", fontWeight: 600, margin: 0 }}>{resolved.title}</h3> : null}
        {resolved.excerpt ? (
          <p style={{ fontSize: "0.9375rem", opacity: 0.85, margin: 0, lineHeight: 1.5 }}>{resolved.excerpt}</p>
        ) : null}
      </a>
    );
  },
};
