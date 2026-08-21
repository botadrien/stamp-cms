// Contexte React qui transporte le Context (voir app/ssg/types.js) jusqu'à chaque
// composant Puck au moment du rendu. Repeater n'est qu'un des composants qui en a
// besoin (le Repeater fournit un Context scoped par item à son slot, mais tout
// composant bindable de la palette doit pouvoir lire le Context courant pour résoudre
// ses propres props) — repeater.jsx réexporte SsgContext/useSsgContext depuis ici pour
// ne pas casser les imports existants.
//
// Puck ne transmet aux composants que ses propres props/metadata (son hook
// `resolveData` par composant est une chose distincte de notre `resolveProps`) — rien
// dans l'API Puck ne permet de faire varier ces metadata par noeud de l'arbre. Le
// Context circule donc via ce contexte React : l'orchestrateur (app/ssg/renderer.jsx)
// enveloppe son <Render> dans un <SsgContext.Provider value={contexteRacine}>, et le
// Repeater fournit son propre <SsgContext.Provider> scoped par item autour de chaque
// rendu de son slot.

import { createContext, useContext } from "react";

/** @typedef {import("../ssg/types.js").Context} Context */

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
