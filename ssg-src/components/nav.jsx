/**
 * Track D (voir docs/plan-puck-ssg.md) : composant Puck "Nav". Boucle sur une
 * collection (liste de liens), donc utilise le vrai champ binding de Track B
 * (déjà fusionné — voir ssg-src/fields/binding-field.jsx) pour choisir sa source :
 * `site.nav` par défaut (voir buildNav() dans ssg-src/context.js), ou une collection
 * de contenu (ex. derniers articles) via le mode "collection" du champ.
 *
 * Le Repeater réel (Track C) n'est pas encore fusionné sur cette branche : la boucle
 * ci-dessous (`items.map`) est un stub minimal en attendant — pas de slot Puck
 * personnalisable par item, juste un gabarit de lien fixe. À remplacer par une
 * composition Repeater + slot une fois Track C fusionné (voir Phase 2 du plan).
 */

import { bindingField } from "../fields/binding-field.jsx";

const VARIANT_OPTIONS = [
  { label: "Horizontal", value: "horizontal" },
  { label: "Vertical", value: "vertical" },
];

function itemLabel(item) {
  return item?.label ?? item?.title ?? "";
}

function itemUrl(item) {
  return item?.url ?? "#";
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
    const resolvedItems = Array.isArray(items) ? items : [];
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
            key={itemUrl(item) || index}
            href={itemUrl(item)}
            style={{ color: "inherit", textDecoration: "none", fontWeight: 500 }}
          >
            {itemLabel(item)}
          </a>
        ))}
      </nav>
    );
  },
};
