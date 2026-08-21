/**
 * resolveProps, la fonction unique utilisée à l'identique en preview et en publication
 * pour remplacer les bindings d'un arbre de props Puck par de vraies valeurs. Voir
 * app/ssg/types.js pour la forme de Context et des BindDescriptor.
 */

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBindDescriptor(value) {
  return isPlainObject(value) && typeof value.$bind === "string";
}

function getByPath(context, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), context);
}

function compareBy(field, order) {
  const direction = order === "asc" ? 1 : -1;
  return (a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    return av > bv ? direction : -direction;
  };
}

/**
 * Résout un CollectionBindDescriptor (voir app/ssg/types.js) en tableau de ContentItem :
 * lit `context.collections[descriptor.from]`, trie et limite selon le descripteur.
 * @param {import("../ssg/types.js").CollectionBindDescriptor} descriptor
 * @param {import("../ssg/types.js").Context} context
 * @returns {import("../ssg/types.js").ContentItem[]}
 */
function resolveCollection(descriptor, context) {
  const items = context.collections?.[descriptor.from] ?? [];
  let result = items.slice();
  if (descriptor.sortBy) {
    result.sort(compareBy(descriptor.sortBy, descriptor.order ?? "asc"));
  }
  if (typeof descriptor.limit === "number") {
    result = result.slice(0, descriptor.limit);
  }
  return result;
}

/**
 * Parcourt récursivement `props` (objets et tableaux) et remplace tout noeud qui a la
 * forme d'un BindDescriptor par sa valeur résolue dans `context` ; les littéraux
 * traversent inchangés. Un noeud `{ $bind: "collection", from, sortBy, order, limit }`
 * est résolu via resolveCollection ; tout autre `{ $bind: "chemin" }` est un lookup
 * simple dans `context`.
 * @type {import("../ssg/types.js").ResolveProps}
 */
export function resolveProps(props, context) {
  if (Array.isArray(props)) {
    return props.map((item) => resolveProps(item, context));
  }
  if (isBindDescriptor(props)) {
    return props.$bind === "collection" ? resolveCollection(props, context) : getByPath(context, props.$bind);
  }
  if (isPlainObject(props)) {
    const resolved = {};
    for (const [key, value] of Object.entries(props)) {
      resolved[key] = resolveProps(value, context);
    }
    return resolved;
  }
  return props;
}
