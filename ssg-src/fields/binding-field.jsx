/**
 * Track B (voir docs/plan-puck-ssg.md) : champ Puck "custom" pour choisir un binding
 * (voir ssg-src/types.js: BindDescriptor) via un sélecteur plutôt qu'un texte libre à
 * parser. Deux modes : "lookup" (chemin fixe dans le contexte, ex. "page.title") et
 * "collection" (requête déclarative sur context.collections, pour les composants type
 * Repeater/nav/liste d'articles).
 */

const LOOKUP_PATHS = [
  "site.title",
  "site.baseUrl",
  "page.title",
  "page.slug",
  "page.url",
  "page.date",
  "page.excerpt",
  "page.body",
  "section.title",
  "section.slug",
  "section.url",
  "item.title",
  "item.slug",
  "item.url",
  "item.date",
  "item.excerpt",
];

const COLLECTIONS = ["pages", "blog"];
const SORT_FIELDS = ["date", "title"];

function LookupEditor({ value, onChange, paths, readOnly }) {
  const current = isBindDescriptor(value) && value.$bind !== "collection" ? value.$bind : "";
  return (
    <select
      value={current}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value ? { $bind: e.target.value } : undefined)}
    >
      <option value="">— aucune valeur —</option>
      {paths.map((path) => (
        <option key={path} value={path}>
          {path}
        </option>
      ))}
    </select>
  );
}

function CollectionEditor({ value, onChange, readOnly }) {
  const descriptor = isBindDescriptor(value) && value.$bind === "collection" ? value : { $bind: "collection", from: COLLECTIONS[0] };
  const update = (patch) => onChange({ ...descriptor, ...patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <select value={descriptor.from} disabled={readOnly} onChange={(e) => update({ from: e.target.value })}>
        {COLLECTIONS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={descriptor.sortBy ?? ""}
        disabled={readOnly}
        onChange={(e) => update({ sortBy: e.target.value || undefined })}
      >
        <option value="">sans tri</option>
        {SORT_FIELDS.map((field) => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
      <select
        value={descriptor.order ?? "desc"}
        disabled={readOnly || !descriptor.sortBy}
        onChange={(e) => update({ order: e.target.value })}
      >
        <option value="desc">décroissant</option>
        <option value="asc">croissant</option>
      </select>
      <input
        type="number"
        min="1"
        value={descriptor.limit ?? ""}
        disabled={readOnly}
        placeholder="limite (optionnel)"
        onChange={(e) => update({ limit: e.target.value ? Number(e.target.value) : undefined })}
      />
    </div>
  );
}

function isBindDescriptor(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.$bind === "string";
}

/**
 * Crée un champ Puck de type "custom" pour choisir un BindDescriptor (voir
 * ssg-src/types.js). `options.paths` restreint la liste des chemins proposés en mode
 * lookup (par défaut LOOKUP_PATHS) ; `options.allowCollection` (par défaut true)
 * ajoute le mode collection, utile pour les props type "source" du Repeater ou d'une
 * nav bindée sur une liste.
 * @param {{ label?: string, paths?: string[], allowCollection?: boolean }} [options]
 */
export function bindingField(options = {}) {
  const paths = options.paths ?? LOOKUP_PATHS;
  const allowCollection = options.allowCollection ?? true;

  return {
    type: "custom",
    label: options.label,
    render: ({ value, onChange, readOnly }) => {
      const mode = isBindDescriptor(value) && value.$bind === "collection" ? "collection" : "lookup";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {allowCollection && (
            <select
              value={mode}
              disabled={readOnly}
              onChange={(e) =>
                onChange(e.target.value === "collection" ? { $bind: "collection", from: COLLECTIONS[0] } : undefined)
              }
            >
              <option value="lookup">Valeur (site / page / item)</option>
              <option value="collection">Collection (liste d'articles/pages)</option>
            </select>
          )}
          {mode === "collection" ? (
            <CollectionEditor value={value} onChange={onChange} readOnly={readOnly} />
          ) : (
            <LookupEditor value={value} onChange={onChange} paths={paths} readOnly={readOnly} />
          )}
        </div>
      );
    },
  };
}
