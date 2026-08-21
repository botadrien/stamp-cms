// Bundle IIFE pour app/app.js (script classique, sans import) — monte l'éditeur visuel Puck
// (@puckeditor/core) comme global `PuckLayoutEditor`, même principe que
// puck-content-editor.jsx (PuckContentEditor) et ssg-builder.js (SsgBuilder) : voir
// README, "Inclusion des packages JS".
//
// puckConfig (la palette de composants, voir app/puck/registry.jsx) est réimporté ici
// plutôt que réutilisé depuis SsgBuilder.puckConfig (déjà bundlé dans
// ssg-builder.bundle.js) — volontairement, malgré la duplication de code que ça cause :
// chaque bundle esbuild IIFE embarque sa PROPRE copie de React (aucun ne partage de
// module runtime avec un autre), donc les fonctions render() de la palette (qui
// appellent useContext(SsgContext) via app/puck/ssg-context.js) doivent tourner sous LE
// MÊME React que celui qui pilote le rendu de <Puck> — sinon les hooks appellent un
// dispatcher React d'une instance différente de celle qui exécute réellement le rendu
// (erreur "Invalid hook call" ou, au mieux, un Context.Provider dont la valeur ne
// traverse jamais jusqu'au useContext() vu depuis l'autre copie de React). Seules des
// données pures (Context lui-même, produit par SsgBuilder.buildContext()) peuvent
// traverser la frontière entre bundles sans risque — jamais des fonctions de rendu.
//
// iframe: { enabled: false } : le canvas d'édition est rendu inline dans le document
// plutôt que dans un iframe isolé — nécessaire pour que le Context React de nos
// composants (SsgContext, voir app/puck/ssg-context.js) traverse jusqu'au rendu de chaque
// bloc dans le canvas ; un iframe serait un realm JS séparé, où useContext() ne verrait
// jamais le <SsgContext.Provider> posé autour de <Puck> ci-dessous. Nos composants
// n'utilisent quasiment que des styles inline (voir app/puck/design-tokens.js), donc le
// risque de collision CSS avec l'UI de Puck elle-même (habituellement la raison de
// vouloir un iframe) reste faible.

import { createRoot } from "react-dom/client";
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { SsgContext } from "../app/puck/ssg-context.js";
import { puckConfig } from "../app/puck/registry.jsx";

let root = null;

/**
 * @param {string} elementId
 * @param {Object} opts
 * @param {import("@puckeditor/core").Data} opts.data
 * @param {import("../app/ssg/types.js").Context} opts.context - contexte de prévisualisation (voir buildLayoutEditorData() dans app/site/site-builder.js)
 * @param {(data: import("@puckeditor/core").Data) => void} opts.onPublish
 * @param {() => void} [opts.onBack]
 */
export function mount(elementId, { data, context, onPublish, onBack }) {
  unmount();
  const el = document.getElementById(elementId);
  root = createRoot(el);
  root.render(
    <SsgContext.Provider value={context}>
      <Puck
        config={puckConfig}
        data={data}
        iframe={{ enabled: false }}
        onPublish={onPublish}
        headerTitle="Mise en page"
        overrides={{
          // `renderHeaderActions` (déprécié) REMPLACE les actions du header plutôt que
          // de les compléter — `overrides.headerActions` reçoit `children` (le bouton
          // "Publish" natif de Puck, voir onPublish ci-dessus) à réafficher explicitement
          // à côté du nôtre, sans quoi il disparaîtrait purement et simplement.
          headerActions: ({ children }) => (
            <>
              {onBack ? (
                <button type="button" onClick={onBack} style={{ marginRight: "0.5rem" }}>
                  ← Retour
                </button>
              ) : null}
              {children}
            </>
          ),
        }}
      />
    </SsgContext.Provider>,
  );
}

export function unmount() {
  if (root) {
    root.unmount();
    root = null;
  }
}
