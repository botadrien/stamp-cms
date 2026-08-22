/**
 * Formes de données du système de thèmes (voir README, section "Thèmes"). Ce fichier ne
 * contient que des JSDoc typedefs, aucune implémentation — même convention que
 * app/ssg/types.js.
 *
 * @typedef {Object} ThemeTokens
 * Même forme que TOKENS (app/puck/design-tokens.js) — c'est ce qui permet de réutiliser
 * TOKENS tel quel comme "thème implicite" d'un site sans clé `theme` dans site.toml (site
 * créé avant l'introduction des thèmes).
 * @property {string} ink
 * @property {string} body
 * @property {string} muted
 * @property {string} accent
 * @property {string} accentSoft
 * @property {string} border
 * @property {string} surface
 * @property {string} surfaceAlt
 * @property {string} radius
 * @property {string} radiusSm
 * @property {string} fontFamily
 * @property {string} cardShadow
 *
 * @typedef {Object} ThemeFontLink
 * Une feuille de style de police web (ex. Google Fonts), injectée dans le <head> du site
 * publié par renderPuckPage() (app/ssg/renderer.jsx) si le thème actif en déclare.
 * @property {string} href
 * @property {boolean} [preconnect] - émet aussi un <link rel="preconnect"> vers l'origine de href
 *
 * @typedef {Object} Theme
 * @property {string} id - même valeur que la clé sous SsgBuilder.themes (voir app/themes/index.js)
 * @property {string} label - affiché dans le sélecteur de thème (app/app.js)
 * @property {string} description - une phrase, affichée sous le label dans le sélecteur
 * @property {ThemeTokens} tokens
 * @property {ThemeFontLink[]} [fontLinks]
 * @property {{home: Object, page: Object, article: Object, blogIndex: Object}} templates -
 *   un Data Puck par type de route, voir LAYOUT_TEMPLATE_FILES dans app/site/site-builder.js
 */

export {};
