// Parse content/*.puck.json (pages standalone) et content/blog/*.puck.json (articles) en
// Collections de ContentItem (voir app/ssg/types.js). Chaque fichier est un objet Data
// Puck standard ({ root: { props: { title, date? } }, content: [...] }) — root.props
// remplace l'ancien front matter TOML, content[] est le corps de la page/l'article,
// injecté au rendu dans le slot du gabarit partagé (voir template-merge.js). Même
// découpage que l'ancien pipeline Markdown : content/_index.puck.json et
// content/blog/_index.puck.json exclus (structurels, pas des pages/articles éditables).

/** @typedef {import("./types.js").ContentItem} ContentItem */
/** @typedef {import("./types.js").Collections} Collections */

// Longueur cible (en caractères de texte, hors balises) d'un excerpt généré faute de
// mieux — voir buildExcerpt().
const EXCERPT_LENGTH = 200;

// Types de composants dont un prop contient du HTML richtext (voir rich-text.jsx) — sert
// à reconstituer un excerpt en texte brut à partir du corps Puck de l'item, faute d'un
// champ "description" dédié pas encore éditable depuis le CMS aujourd'hui.
const RICHTEXT_FIELDS = { RichText: "body", Accordion: "body" };

// Même règle que titleFromPath() dans app/site/site-builder.js : nom de fichier -> titre lisible,
// utilisé quand root.props n'a pas de champ `title`.
function titleFromPath(path) {
  const base = path.split("/").pop().replace(/\.puck\.json$/, "");
  const words = base.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Même règle que pageUrl() dans app/site/site-builder.js : content/a-propos.puck.json ->
// /a-propos/, content/blog/mon-article.puck.json -> /blog/mon-article/.
function pageUrl(path) {
  return "/" + path.replace(/^content\//, "").replace(/\.puck\.json$/, "") + "/";
}

// Identifiant court d'un item : le nom de fichier sans extension, sans le préfixe de
// répertoire — les pages et les articles vivent déjà dans deux collections séparées, pas
// besoin de préfixer le slug pour éviter les collisions entre les deux.
function slugFromPath(path) {
  return path.split("/").pop().replace(/\.puck\.json$/, "");
}

// Le contenu du dépôt peut arriver en texte (déjà décodé) ou en octets (Uint8Array, comme
// renvoyé par getRepoFiles() dans app/site/repo-cache.js) — les deux formes sont acceptées pour ne
// pas imposer un décodage préalable à l'appelant.
function toText(content) {
  if (typeof content === "string") return content;
  return new TextDecoder().decode(content);
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Parcourt le corps Puck de l'item (content[]), concatène le texte brut de tout champ
// richtext rencontré (voir RICHTEXT_FIELDS), tronque sur une frontière de mot — même
// logique de troncature que l'ancien buildExcerpt() basé sur le Markdown rendu.
function buildExcerptFromContent(content, maxLength = EXCERPT_LENGTH) {
  const text = (content || [])
    .map((node) => {
      const propName = RICHTEXT_FIELDS[node.type];
      return propName ? stripHtml(node.props?.[propName] || "") : "";
    })
    .filter(Boolean)
    .join(" ");
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

// Parse un seul fichier content/*.puck.json en ContentItem. Exporté séparément de
// loadCollections() pour permettre à un appelant (ex. le renderer, pour une preview d'un
// brouillon pas encore enregistré) de parser un fichier isolé sans reconstruire tout le
// dépôt.
export function parseContentFile(path, rawContent) {
  const data = JSON.parse(toText(rawContent));
  const props = data.root?.props || {};

  const title = typeof props.title === "string" && props.title ? props.title : titleFromPath(path);
  const content = data.content || [];

  /** @type {ContentItem} */
  const item = {
    title,
    slug: slugFromPath(path),
    url: pageUrl(path),
    content,
    excerpt: buildExcerptFromContent(content),
  };
  if (props.date) item.date = props.date;
  return item;
}

// Point d'entrée principal : prend l'ensemble des fichiers du dépôt (même forme que
// getRepoFiles() dans app/site/repo-cache.js — { chemin: contenu }, contenu en texte ou en octets)
// et retourne les Collections { pages, blog } conformes au typedef du même nom dans
// app/ssg/types.js. Ne garde que content/*.puck.json et content/blog/*.puck.json, exclut
// les _index.puck.json (accueil et section blog : structurels, pas des ContentItem —
// même exclusion que listContentPages() dans app/site/site-builder.js).
export async function loadCollections(files) {
  /** @type {ContentItem[]} */
  const pages = [];
  /** @type {ContentItem[]} */
  const blog = [];

  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith("content/") || !path.endsWith(".puck.json")) continue;
    if (path.endsWith("_index.puck.json")) continue;

    // Un fichier .puck.json illisible (JSON invalide, écrit hors du CMS ou corrompu) ne
    // doit pas faire échouer la republication de tout le site quand on publie une AUTRE
    // page — on l'exclut des Collections plutôt que de laisser JSON.parse() faire planter
    // buildSite() en entier.
    let item;
    try {
      item = parseContentFile(path, content);
    } catch (err) {
      console.error(`Fichier de contenu illisible, ignoré : ${path}`, err.message);
      continue;
    }
    if (path.startsWith("content/blog/")) {
      blog.push(item);
    } else {
      pages.push(item);
    }
  }

  // Même ordre que listContentPages() (tri alphabétique par titre) pour les pages
  // standalone ; les articles de blog, eux, en ordre antéchronologique (le plus récent
  // d'abord) par défaut — un binding de collection (voir BindDescriptor dans types.js)
  // peut toujours redemander un autre tri explicitement.
  pages.sort((a, b) => a.title.localeCompare(b.title));
  blog.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return { pages, blog };
}
