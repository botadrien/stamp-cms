// Bundle IIFE pour app.js (script classique, sans import) — monte l'éditeur de contenu
// Puck (@puckeditor/core) comme global `PuckContentEditor`, même principe que
// puck-layout-editor.jsx (PuckLayoutEditor). Remplace l'ancien editor.jsx (BlockNote,
// window.RichEditor).
//
// Contrairement à l'éditeur de mise en page (config complète, tous les composants de la
// palette), cet éditeur utilise une Config Puck restreinte (voir contentPuckConfig
// ci-dessous) : seuls des blocs de contenu (RichText + Callout/Quote/Divider/CodeBlock/
// Accordion, voir ssg-src/components/) y sont enregistrés, donc il est structurellement
// impossible d'y glisser un Nav/Hero/Footer — le contenu d'un article/d'une page reste un
// corps de texte, jamais sa propre mise en page (nav/hero/footer restent définis une fois
// par type de route, voir templates/page.puck.json / templates/article.puck.json). Ces
// blocs sont aussi enregistrés dans la palette complète (ssg-src/registry.jsx) : le
// renderer de publication (ssg-src/renderer.jsx) s'appuie sur cette palette-là pour
// rendre le contenu fusionné dans ContentSlot — un type de bloc absent de registry.jsx
// planterait le rendu de toute page en contenant un, même si l'édition elle-même se fait
// ici. Deux
// variantes de champs racine : une page standalone n'a pas de date, un article en a une
// (voir `kind` ci-dessous, "page" ou "post" — mêmes valeurs que celles déjà utilisées par
// addPage()/listContentPages() dans app.js/site-builder.js).
//
// iframe: { enabled: false } : comme puck-layout-editor.jsx, même si RichText n'a lui-même
// aucun binding à résoudre via SsgContext. Testé les deux réglages en pratique (voir
// e2e/probe-editor.mjs, script jetable) : l'édition inline directement dans le canvas
// (superposition "portail" de @puckeditor/core, registerOverlayPortal) ne fonctionne
// correctement qu'avec l'iframe par défaut de Puck ET une vraie sélection pointeur — mais
// avec cet iframe, la sélection d'un bloc programmatique/cross-frame se comporte
// différemment (observé : le clic ne fait pas basculer le bloc en mode édition). Sans
// iframe, la sélection fonctionne à coup sûr et le champ richtext reste éditable — juste
// depuis le panneau de champs (sidebar droite), pas par clic direct sur le texte dans le
// canvas (qui y reste affiché en lecture seule, hauteur nulle pour la superposition
// inutilisée). Compromis retenu : fiabilité de la sélection/sauvegarde plutôt que l'édition
// inline "à la Notion" dans le canvas lui-même.

import { createRoot } from "react-dom/client";
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { RichText } from "../ssg-src/components/rich-text.jsx";
import { Callout } from "../ssg-src/components/callout.jsx";
import { Quote } from "../ssg-src/components/quote.jsx";
import { Divider } from "../ssg-src/components/divider.jsx";
import { CodeBlock } from "../ssg-src/components/code-block.jsx";
import { Accordion } from "../ssg-src/components/accordion.jsx";

const ROOT_FIELDS_BASE = {
  title: { type: "text", label: "Titre" },
};

const ROOT_FIELDS_POST = {
  ...ROOT_FIELDS_BASE,
  date: { type: "text", label: "Date (AAAA-MM-JJ)" },
};

const CONTENT_COMPONENTS = { RichText, Callout, Quote, Divider, CodeBlock, Accordion };

function configFor(kind) {
  return {
    components: CONTENT_COMPONENTS,
    root: { fields: kind === "post" ? ROOT_FIELDS_POST : ROOT_FIELDS_BASE },
  };
}

let root = null;
let latestData = null;

/**
 * @param {string} elementId
 * @param {Object} opts
 * @param {import("@puckeditor/core").Data} opts.data
 * @param {"page"|"post"} opts.kind
 * @param {() => void} [opts.onChange] - notifié à chaque modification (aperçu en direct,
 *   voir app.js) — pas de valeur passée, l'appelant relit via getData() si besoin, pour
 *   ne jamais désynchroniser deux façons différentes de lire l'état éditeur.
 */
export function mount(elementId, { data, kind, onChange }) {
  unmount();
  latestData = data;
  const el = document.getElementById(elementId);
  root = createRoot(el);
  root.render(
    <Puck
      config={configFor(kind)}
      data={data}
      iframe={{ enabled: false }}
      onChange={(newData) => {
        latestData = newData;
        onChange?.();
      }}
      viewports={[]}
    />,
  );
}

export function getData() {
  return latestData;
}

export function unmount() {
  if (root) {
    root.unmount();
    root = null;
  }
  latestData = null;
}
