/**
 * Contrat partagé entre les tracks parallèles du renderer Puck (voir
 * docs/plan-puck-ssg.md, section "Parallélisation"). Ce fichier ne contient que des
 * formes de données (JSDoc typedefs), aucune implémentation — chaque track importe
 * ces types pour rester compatible avec les autres sans attendre leur code réel.
 *
 * @typedef {Object} ContentItem
 * @property {string} title
 * @property {string} slug
 * @property {string} url
 * @property {string} [date] - ISO 8601, absent pour les pages standalone sans date
 * @property {string} [excerpt]
 * @property {Array<Object>} content - corps Puck de la page/l'article (tableau de nœuds
 *   Data, voir content-loader.js), injecté au rendu dans le slot ContentSlot du gabarit
 *   partagé (voir template-merge.js)
 *
 * @typedef {Object} Collections
 * Reprend le split déjà fait côté app existante (`app/app.js`:
 * `listContentPages`/`renderPageGroup`) : pages standalone vs articles de blog.
 * @property {ContentItem[]} pages
 * @property {ContentItem[]} blog
 *
 * @typedef {Object} SiteContext
 * @property {string} title
 * @property {string} baseUrl
 * @property {Array<{label: string, url: string}>} nav
 *
 * @typedef {Object} Context
 * Objet passé à resolveProps ; reconstruit à chaque build/preview.
 * @property {SiteContext} site
 * @property {ContentItem} [page] - page courante, absente hors contexte de page
 * @property {{title: string, slug: string, url: string}} [section] - section courante, si applicable
 * @property {Collections} collections
 * @property {any} [item] - ajouté par le Repeater : item courant de la boucle, même forme que ContentItem
 *
 * @typedef {Object} LookupBindDescriptor
 * Binding simple : va chercher une valeur dans le contexte par chemin.
 * @property {string} $bind - chemin pointé, ex. "site.title", "page.title", "item.excerpt"
 *
 * @typedef {Object} CollectionBindDescriptor
 * Binding sur une collection : résout en tableau de ContentItem.
 * @property {"collection"} $bind
 * @property {"pages"|"blog"} from - clé dans Context.collections
 * @property {string} [sortBy] - champ de tri, ex. "date"
 * @property {"asc"|"desc"} [order]
 * @property {number} [limit]
 *
 * @typedef {LookupBindDescriptor | CollectionBindDescriptor} BindDescriptor
 *
 * @typedef {(props: Object.<string, any>, context: Context) => Object.<string, any>} ResolveProps
 * Parcourt récursivement props (objets/tableaux), remplace tout noeud qui a la forme
 * d'un BindDescriptor par sa valeur résolue dans context, laisse le reste inchangé.
 * Une seule implémentation, utilisée à l'identique en preview et en publication.
 */

export {};
