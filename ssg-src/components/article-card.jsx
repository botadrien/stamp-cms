/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "ArticleCard". Boucle sur une
 * collection d'articles, donc utilise le vrai champ binding de Track B (déjà fusionné
 * — voir ssg-src/fields/binding-field.jsx) en mode "collection" pour choisir sa source
 * (ex. `blog`, triée par date décroissante, limitée à N éléments).
 *
 * Reste un gabarit de carte fixe (titre/date/extrait/lien) plutôt qu'une composition
 * Repeater + slot : pour une mise en page de carte personnalisable par item, voir
 * plutôt Repeater (ssg-src/components/repeater.jsx) + ArticleTeaser
 * (ssg-src/components/article-teaser.jsx). ArticleCard reste utile tel quel quand la
 * mise en page de carte n'a pas besoin d'être personnalisée par item.
 */

import { bindingField } from "../fields/binding-field.jsx";
import { resolveProps } from "../resolver.js";
import { useSsgContext } from "../ssg-context.js";
import { resolveHref } from "../context.js";

const COLUMNS_OPTIONS = [1, 2, 3].map((value) => ({ label: `${value} colonne${value > 1 ? "s" : ""}`, value }));

function formatDate(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

export const ArticleCard = {
  label: "Cartes d'article",
  fields: {
    source: bindingField({ label: "Source des articles", paths: [], allowCollection: true }),
    columns: { type: "select", label: "Colonnes", options: COLUMNS_OPTIONS },
    accentColor: { type: "text", label: "Couleur d'accent (hex)" },
  },
  defaultProps: {
    source: { $bind: "collection", from: "blog", sortBy: "date", order: "desc", limit: 3 },
    columns: 3,
    accentColor: "#2563eb",
  },
  render: ({ source, columns, accentColor }) => {
    const context = useSsgContext();
    const { source: resolvedSource } = resolveProps({ source }, context);
    const items = Array.isArray(resolvedSource) ? resolvedSource : [];
    return (
      <div
        style={{
          display: "grid",
          gap: "1.5rem",
          gridTemplateColumns: `repeat(${columns || 3}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item, index) => (
          <a
            key={item?.url ?? index}
            href={item?.url ? resolveHref(context, item.url) : "#"}
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
            {item?.date ? (
              <span style={{ fontSize: "0.8125rem", color: accentColor || "#2563eb", fontWeight: 600 }}>
                {formatDate(item.date)}
              </span>
            ) : null}
            {item?.title ? <h3 style={{ fontSize: "1.0625rem", fontWeight: 600, margin: 0 }}>{item.title}</h3> : null}
            {item?.excerpt ? (
              <p style={{ fontSize: "0.9375rem", opacity: 0.85, margin: 0, lineHeight: 1.5 }}>{item.excerpt}</p>
            ) : null}
          </a>
        ))}
      </div>
    );
  },
};
