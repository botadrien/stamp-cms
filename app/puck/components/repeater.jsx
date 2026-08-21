/**
 * Composant Puck "Repeater" — rend son slot une fois par item résolu d'une collection.
 *
 * Prop `source` : un descripteur au format CollectionBindDescriptor (voir
 * app/ssg/types.js), ex. `{ $bind: "collection", from: "blog", sortBy: "date",
 * order: "desc", limit: 5 }`, édité via le champ Puck bindingField().
 *
 * Prop `content` : un slot Puck (`type: "slot"`). Pour chaque item résolu de
 * `source`, ce slot est affiché une fois, avec un contexte étendu `{ ...context,
 * item }` — les composants enfants du slot bindent sur `item.title`, `item.excerpt`,
 * etc. via `{ $bind: "item.xxx" }`.
 *
 * Comment le contexte circule jusqu'ici : Puck ne transmet aux composants que ses
 * propres props/metadata (son hook `resolveData` par composant est une chose
 * distincte de notre `resolveProps`) — rien dans l'API Puck ne permet de faire varier
 * ces metadata par appel du slot. Le Context (voir app/ssg/types.js) circule donc via
 * `SsgContext` (app/puck/ssg-context.js, partagé par toute la palette, pas seulement le
 * Repeater) : chaque item de la boucle fournit son propre `SsgContext.Provider` autour
 * de son rendu du slot, et tout composant qui affiche une valeur bindée doit lire ce
 * contexte via `useSsgContext()` et appeler `resolveProps` sur ses propres props avant
 * affichage — exactement ce que ce composant fait lui-même pour sa prop `source`.
 * L'orchestrateur (app/ssg/renderer.jsx) enveloppe son appel à `<Render>` dans
 * `<SsgContext.Provider value={context}>` pour que le contexte racine
 * (site/page/section/collections) soit disponible même hors de tout Repeater.
 */

import { resolveProps } from "../resolver.js";
import { bindingField } from "../fields/binding-field.jsx";
import { SsgContext, useSsgContext } from "../ssg-context.js";

export { SsgContext, useSsgContext };

/**
 * Config Puck du composant Repeater (fields + render), enregistrée dans le registre de
 * composants (app/puck/registry.jsx).
 */
export const Repeater = {
  label: "Répéteur",
  fields: {
    source: bindingField({ label: "Collection à répéter" }),
    content: { type: "slot" },
  },
  defaultProps: {
    source: { $bind: "collection", from: "blog" },
  },
  render({ source, content, puck }) {
    const context = useSsgContext();
    const { source: resolvedSource } = resolveProps({ source }, context);
    const items = Array.isArray(resolvedSource) ? resolvedSource : [];

    if (puck.isEditing) {
      // Dans le canvas d'édition, afficher le slot une seule fois (avec le premier
      // item réel comme aperçu si disponible) pour que les auteur·ices puissent
      // glisser-déposer leur gabarit même quand la collection est vide.
      const previewItem = items[0];
      return (
        <SsgContext.Provider value={previewItem ? { ...context, item: previewItem } : context}>
          {content()}
        </SsgContext.Provider>
      );
    }

    return (
      <>
        {items.map((item, index) => (
          <SsgContext.Provider key={item?.slug ?? index} value={{ ...context, item }}>
            {content()}
          </SsgContext.Provider>
        ))}
      </>
    );
  },
};
