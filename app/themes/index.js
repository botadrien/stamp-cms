// Registre des thèmes natifs (voir README, section "Thèmes"). Un site sans clé `theme`
// dans site.toml (créé avant l'introduction des thèmes) n'utilise aucun de ces objets —
// il retombe sur app/ssg/default-templates.js et la palette TOKENS d'origine (voir
// resolveThemeFromRepoFiles() dans app/site/site-builder.js).

import { saas } from "./saas/index.js";
import { devblog } from "./devblog/index.js";
import { nonprofit } from "./nonprofit/index.js";

/** @type {Object.<string, import("./types.js").Theme>} */
export const themes = { saas, devblog, nonprofit };

/** @type {import("./types.js").Theme[]} */
export const themeList = [saas, devblog, nonprofit];

export const DEFAULT_THEME_ID = "saas";
