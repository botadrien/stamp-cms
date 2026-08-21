// Bundle IIFE pour site-builder.js (script classique, sans import) — expose le
// renderer Puck (ssg-src/renderer.jsx) comme global `SsgBuilder`, en remplacement de
// zola-builder.js. Même principe que editor.jsx (RichEditor) : voir README, "Inclusion
// des packages JS".

import { buildSite } from "../ssg-src/renderer.jsx";
import { defaultTemplates } from "../ssg-src/default-templates.js";

export { buildSite, defaultTemplates };
