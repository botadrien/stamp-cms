// Bundle IIFE pour site-builder.js (script classique, sans import) — expose le
// renderer Puck (ssg-src/renderer.jsx) comme global `SsgBuilder`, en remplacement de
// zola-builder.js. Même principe que editor.jsx (RichEditor) : voir README, "Inclusion
// des packages JS".
//
// loadCollections/buildContext sont aussi exposés ici (pas seulement buildSite) : l'app
// (site-builder.js) en a besoin pour construire le Context de prévisualisation de
// l'éditeur de mise en page Puck (voir editor-src/puck-layout-editor.jsx) sans dupliquer
// la lecture de contenu (gray-matter, qui a besoin du polyfill Buffer déjà injecté sur ce
// bundle, voir editor-src/buffer-shim.js) dans un second bundle. Uniquement des données
// pures (pas de composants/fonctions de rendu) : voir la docstring de
// puck-layout-editor.jsx pour pourquoi la palette de composants (ssg-src/registry.jsx),
// elle, est réimportée séparément là-bas plutôt que réutilisée depuis ce bundle.

import { buildSite } from "../ssg-src/renderer.jsx";
import { defaultTemplates } from "../ssg-src/default-templates.js";
import { loadCollections } from "../ssg-src/content-loader.js";
import { buildContext } from "../ssg-src/context.js";

export { buildSite, defaultTemplates, loadCollections, buildContext };
