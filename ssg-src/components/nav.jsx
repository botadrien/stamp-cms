/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "Nav". Boucle sur une
 * collection (liste de liens), donc utilise le vrai champ binding de Track B
 * (déjà fusionné — voir ssg-src/fields/binding-field.jsx) pour choisir sa source :
 * `site.nav` par défaut (voir buildNav() dans ssg-src/context.js), ou une collection
 * de contenu (ex. derniers articles) via le mode "collection" du champ.
 *
 * Une nav n'a pas besoin du slot du Repeater (chaque lien est juste { label, url },
 * pas une mise en page composable par item) — elle résout directement sa prop `items`
 * via `resolveProps`/`useSsgContext` (voir ssg-src/ssg-context.js), sans passer par le
 * Repeater. Ce que le Repeater apporte en plus (slot personnalisable par item) sert à
 * ArticleTeaser (voir ssg-src/components/article-teaser.jsx), pas à la nav.
 */

import { bindingField } from "../fields/binding-field.jsx";
import { resolveProps } from "../resolver.js";
import { useSsgContext } from "../ssg-context.js";
import { resolveHref } from "../context.js";

const VARIANT_OPTIONS = [
  { label: "Horizontal", value: "horizontal" },
  { label: "Vertical", value: "vertical" },
];

function itemLabel(item) {
  return item?.label ?? item?.title ?? "";
}

// item.url est racine-relatif au contenu (voir resolveHref() dans ssg-src/context.js) —
// jamais utilisé tel quel comme href, sinon les liens casseraient sur tout site publié
// hors de la racine du domaine.
function itemHref(item, context) {
  return item?.url ? resolveHref(context, item.url) : "#";
}

export const Nav = {
  label: "Navigation",
  fields: {
    items: bindingField({ label: "Source des liens", paths: ["site.nav"] }),
    variant: { type: "select", label: "Orientation", options: VARIANT_OPTIONS },
    backgroundColor: { type: "text", label: "Couleur de fond (hex)" },
    textColor: { type: "text", label: "Couleur du texte (hex)" },
  },
  defaultProps: {
    items: { $bind: "site.nav" },
    variant: "horizontal",
    backgroundColor: "transparent",
    textColor: "#0f172a",
  },
  render: ({ items, variant, backgroundColor, textColor }) => {
    const context = useSsgContext();
    const { items: resolved } = resolveProps({ items }, context);
    const resolvedItems = Array.isArray(resolved) ? resolved : [];
    return (
      <nav
        style={{
          "--ssg-nav-bg": backgroundColor || "transparent",
          "--ssg-nav-fg": textColor || "#0f172a",
          backgroundColor: "var(--ssg-nav-bg)",
          color: "var(--ssg-nav-fg)",
          display: "flex",
          flexDirection: variant === "vertical" ? "column" : "row",
          gap: variant === "vertical" ? "0.5rem" : "1.5rem",
          padding: "1rem 1.5rem",
        }}
      >
        {resolvedItems.map((item, index) => (
          <a
            key={item?.url ?? index}
            href={itemHref(item, context)}
            style={{ color: "inherit", textDecoration: "none", fontWeight: 500 }}
          >
            {itemLabel(item)}
          </a>
        ))}
      </nav>
    );
  },
};
