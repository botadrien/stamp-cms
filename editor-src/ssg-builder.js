// Bundle IIFE pour app/site/site-builder.js (script classique, sans import) — expose le
// renderer Puck (app/ssg/renderer.jsx) comme global `SsgBuilder`. Même principe que
// puck-layout-editor.jsx (PuckLayoutEditor) et puck-content-editor.jsx
// (PuckContentEditor) : voir README, "Inclusion des packages JS".
//
// loadCollections/buildContext sont aussi exposés ici (pas seulement buildSite) : l'app
// (app/site/site-builder.js) en a besoin pour construire le Context de prévisualisation de
// l'éditeur de mise en page Puck (voir editor-src/puck-layout-editor.jsx) sans dupliquer
// la lecture de contenu dans un second bundle. Uniquement des données pures (pas de
// composants/fonctions de rendu) : voir la docstring de puck-layout-editor.jsx pour
// pourquoi la palette de composants (app/puck/registry.jsx), elle, est réimportée
// séparément là-bas plutôt que réutilisée depuis ce bundle.

import { buildSite } from "../app/ssg/renderer.jsx";
import { defaultTemplates } from "../app/ssg/default-templates.js";
import { loadCollections } from "../app/ssg/content-loader.js";
import { buildContext } from "../app/ssg/context.js";
import { themes, themeList, DEFAULT_THEME_ID } from "../app/themes/index.js";

export { buildSite, defaultTemplates, loadCollections, buildContext, themes, themeList, DEFAULT_THEME_ID };
