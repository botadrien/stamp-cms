/**
 * Composant Puck "ArticleCard". Boucle sur une collection d'articles, donc utilise le
 * champ binding (voir app/puck/fields/binding-field.jsx) en mode "collection" pour choisir sa source
 * (ex. `blog`, triée par date décroissante, limitée à N éléments).
 *
 * Reste un gabarit de carte fixe (titre/date/extrait/lien) plutôt qu'une composition
 * Repeater + slot : pour une mise en page de carte personnalisable par item, voir
 * plutôt Repeater (app/puck/components/repeater.jsx) + ArticleTeaser
 * (app/puck/components/article-teaser.jsx). ArticleCard reste utile tel quel quand la
 * mise en page de carte n'a pas besoin d'être personnalisée par item.
 */

import { bindingField } from "../fields/binding-field.jsx";
import { resolveProps } from "../resolver.js";
import { useSsgContext } from "../ssg-context.js";
import { resolveHref } from "../../ssg/context.js";
import { TOKENS, cssVar } from "../design-tokens.js";

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
    accentColor: TOKENS.accent,
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
          fontFamily: cssVar("fontFamily"),
        }}
      >
        {items.map((item, index) => (
          <a
            key={item?.url ?? index}
            href={item?.url ? resolveHref(context, item.url) : "#"}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              padding: "1.5rem",
              borderRadius: cssVar("radius"),
              border: `1px solid ${cssVar("border")}`,
              boxShadow: cssVar("cardShadow"),
              backgroundColor: cssVar("surface"),
              color: "inherit",
              textDecoration: "none",
            }}
          >
            {item?.date ? (
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: accentColor || TOKENS.accent,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {formatDate(item.date)}
              </span>
            ) : null}
            {item?.title ? (
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: cssVar("ink") }}>{item.title}</h3>
            ) : null}
            {item?.excerpt ? (
              <p style={{ fontSize: "0.9375rem", color: cssVar("body"), margin: 0, lineHeight: 1.55 }}>{item.excerpt}</p>
            ) : null}
          </a>
        ))}
      </div>
    );
  },
};
