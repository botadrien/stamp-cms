// Parse content/*.md (pages standalone) et content/blog/*.md (articles) en Collections
// de ContentItem (voir ssg-src/types.js) — reprend exactement le découpage déjà fait
// côté pipeline Zola existant : listContentPages()/extractTitle() dans site-builder.js
// (front matter TOML délimité par "+++", titre déduit du front matter sinon du nom de
// fichier, content/_index.md et content/blog/_index.md exclus car structurels — pas des
// pages/articles éditables) et pageUrl() pour la convention d'URL. Aucune dépendance
// WASM : front matter + Markdown parsés avec des libs JS pures (gray-matter + smol-toml
// pour le bloc TOML, remark/remark-html pour le corps).

import matter from "gray-matter";
import { parse as parseToml } from "smol-toml";
import { remark } from "remark";
import remarkHtml from "remark-html";

/** @typedef {import("./types.js").ContentItem} ContentItem */
/** @typedef {import("./types.js").Collections} Collections */

const FRONT_MATTER_OPTIONS = {
  delimiters: "+++",
  language: "toml",
  engines: { toml: parseToml },
};

// Longueur cible (en caractères de texte, hors balises) d'un excerpt généré faute de
// mieux — voir buildExcerpt().
const EXCERPT_LENGTH = 200;

// Même règle que titleFromPath() dans site-builder.js : nom de fichier -> titre lisible,
// utilisé quand le front matter n'a pas de champ `title`.
function titleFromPath(path) {
  const base = path.split("/").pop().replace(/\.md$/, "");
  const words = base.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Même règle que pageUrl() dans site-builder.js : content/a-propos.md -> /a-propos/,
// content/blog/mon-article.md -> /blog/mon-article/.
function pageUrl(path) {
  return "/" + path.replace(/^content\//, "").replace(/\.md$/, "") + "/";
}

// Identifiant court d'un item : le nom de fichier sans extension, sans le préfixe de
// répertoire — les pages et les articles vivent déjà dans deux collections séparées, pas
// besoin de préfixer le slug pour éviter les collisions entre les deux.
function slugFromPath(path) {
  return path.split("/").pop().replace(/\.md$/, "");
}

// Le contenu du dépôt peut arriver en texte (déjà décodé) ou en octets (Uint8Array, comme
// renvoyé par getRepoFiles() dans repo-cache.js) — les deux formes sont acceptées pour ne
// pas imposer un décodage préalable à l'appelant.
function toText(content) {
  if (typeof content === "string") return content;
  return new TextDecoder().decode(content);
}

// smol-toml renvoie une sous-classe de Date pour les dates TOML (locales, sans fuseau) —
// normalisé en chaîne ISO "YYYY-MM-DD" pour matcher le format écrit par ensureFrontMatter()
// dans site-builder.js (`date = new Date().toISOString().slice(0, 10)`). Les autres types
// (déjà une chaîne, ex. front matter écrit à la main) traversent tels quels.
function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

// Version texte brut (balises retirées) du HTML rendu, tronquée sur une frontière de mot —
// faute d'un extrait plus malin (ex. un champ `description` dédié dans le front matter, pas
// encore éditable depuis le CMS aujourd'hui).
function buildExcerpt(html, maxLength = EXCERPT_LENGTH) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

async function renderMarkdownToHtml(markdown) {
  const file = await remark().use(remarkHtml).process(markdown);
  return String(file);
}

// Parse un seul fichier content/*.md en ContentItem. Exporté séparément de
// loadCollections() pour permettre à un appelant (ex. le futur renderer, pour une preview
// d'un brouillon pas encore enregistré) de parser un fichier isolé sans reconstruire tout
// le dépôt.
export async function parseContentFile(path, rawContent) {
  const text = toText(rawContent);
  const { data: frontMatter, content: rawBody } = matter(text, FRONT_MATTER_OPTIONS);

  const title = typeof frontMatter.title === "string" ? frontMatter.title : titleFromPath(path);
  const body = await renderMarkdownToHtml(rawBody);

  /** @type {ContentItem} */
  const item = {
    title,
    slug: slugFromPath(path),
    url: pageUrl(path),
    body,
    excerpt: buildExcerpt(body),
    frontMatter,
  };
  if (frontMatter.date !== undefined && frontMatter.date !== null) {
    item.date = normalizeDate(frontMatter.date);
  }
  return item;
}

// Point d'entrée principal : prend l'ensemble des fichiers du dépôt (même forme que
// getRepoFiles() dans repo-cache.js — { chemin: contenu }, contenu en texte ou en octets)
// et retourne les Collections { pages, blog } conformes au typedef du même nom dans
// ssg-src/types.js. Ne garde que content/*.md et content/blog/*.md, exclut les
// _index.md (accueil et section blog : structurels, pas des ContentItem — même exclusion
// que listContentPages() dans site-builder.js).
export async function loadCollections(files) {
  /** @type {ContentItem[]} */
  const pages = [];
  /** @type {ContentItem[]} */
  const blog = [];

  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith("content/") || !path.endsWith(".md")) continue;
    if (path.endsWith("_index.md")) continue;

    const item = await parseContentFile(path, content);
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
