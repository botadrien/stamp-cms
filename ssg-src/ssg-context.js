// Phase 2 (intégration, voir docs/plan-puck-ssg.md) : contexte React qui transporte le
// Context (voir ssg-src/types.js) jusqu'à chaque composant Puck au moment du rendu.
// Extrait de ssg-src/components/repeater.jsx (Track C) vers ce module partagé : Repeater
// n'est qu'un des composants qui en a besoin (le Repeater fournit un Context scoped par
// item à son slot, mais tout composant bindable — palette de Track D notamment — doit
// pouvoir lire le Context courant pour résoudre ses propres props). repeater.jsx réexporte
// depuis ici pour ne rien casser côté imports déjà écrits.
//
// Puck ne transmet aux composants que ses propres props/metadata (son hook `resolveData`
// par composant est une chose distincte de notre `resolveProps`, voir
// docs/plan-puck-ssg.md) — rien dans l'API Puck ne permet de faire varier ces metadata par
// noeud de l'arbre. Le Context circule donc via ce contexte React : l'orchestrateur
// (ssg-src/renderer.jsx, tâche 5) enveloppe son <Render> dans un
// <SsgContext.Provider value={contexteRacine}>, et le Repeater fournit son propre
// <SsgContext.Provider> scoped par item autour de chaque rendu de son slot.

import { createContext, useContext } from "react";

/** @typedef {import("./types.js").Context} Context */

const EMPTY_CONTEXT = {
  site: { title: "", baseUrl: "", nav: [] },
  collections: { pages: [], blog: [] },
};

/** @type {import("react").Context<Context | undefined>} */
export const SsgContext = createContext(undefined);

/** @returns {Context} */
export function useSsgContext() {
  return useContext(SsgContext) ?? EMPTY_CONTEXT;
}
