// Tâche 10 (voir docs/plan-puck-ssg.md, "Point de contrôle prototype") : construit un
// site de démo avec le renderer Puck (ssg-src/renderer.jsx) à partir d'un contenu
// Markdown fixture, et écrit le résultat HTML/XML dans tmp/ssg-preview/ — pour
// vérifier à l'œil (et par un serveur statique local) que bindings + collections +
// slot API de Puck coopèrent bien sur un vrai cas d'usage (page d'index avec
// Repeater), avant d'aller plus loin sur l'intégration dans l'app.
//
// Fichiers *.jsx importés directement : ce script n'est pas exécuté tel quel par Node
// (JSX non supporté nativement) mais bundlé au préalable avec esbuild — voir la cible
// "ssg:preview" du README ou lancer à la main :
//   npx esbuild scripts/ssg-prototype-preview.mjs --bundle --platform=node \
//     --format=esm --packages=external --jsx=automatic --outfile=tmp/ssg-preview-bundle.mjs
//   node tmp/ssg-preview-bundle.mjs

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSite } from "../ssg-src/renderer.jsx";

const OUT_DIR = new URL("../tmp/ssg-preview/", import.meta.url);

// Contenu fixture, même forme que getRepoFiles()/fetchContentFiles() (site-builder.js) :
// { "content/xxx.md": "texte front matter + corps" }.
const files = {
  "content/a-propos.md": `+++
title = "À propos"
+++

Ceci est une page fixture pour le point de contrôle prototype.
`,
  "content/blog/lancement-du-nouveau-moteur.md": `+++
title = "Lancement du nouveau moteur de rendu"
date = 2026-08-10
+++

On vient de remplacer Zola/Tera par un renderer maison piloté par Puck — voir
\`docs/plan-puck-ssg.md\` pour le détail. Cet article sert de contenu fixture au
point de contrôle prototype (tâche 10).
`,
  "content/blog/comment-fonctionnent-les-bindings.md": `+++
title = "Comment fonctionnent les bindings"
date = 2026-08-05
+++

Un binding est un champ Puck qui, au lieu d'une valeur tapée en dur, contient un
descripteur \`{ $bind: "chemin" }\` résolu au moment du rendu par \`resolveProps\`.
`,
  "content/blog/le-composant-repeater.md": `+++
title = "Le composant Repeater"
date = 2026-07-28
+++

Le Repeater répète son slot une fois par item d'une collection, avec un contexte
scoped par item — c'est ce que cette page d'accueil utilise pour lister les
derniers articles.
`,
};

// Gabarit Puck de l'accueil : Nav + Hero + Repeater (bindé sur la collection blog,
// limité aux 2 plus récents) dont le slot contient un ArticleTeaser bindé sur
// item.title/item.date/item.excerpt/item.url — le cas exact visé par la tâche 10.
const homeTemplate = {
  root: { props: {} },
  content: [
    {
      type: "Nav",
      props: {
        id: "nav-1",
        items: { $bind: "site.nav" },
        variant: "horizontal",
        backgroundColor: "#0f172a",
        textColor: "#f8fafc",
      },
    },
    {
      type: "Hero",
      props: {
        id: "hero-1",
        eyebrow: "Point de contrôle prototype",
        title: "Un site propulsé par le renderer Puck maison",
        subtitle: "Bindings, collections et slot API de Puck, mis bout à bout (tâche 10 du plan).",
        ctaLabel: "",
        ctaUrl: "",
        align: "center",
        spacing: "md",
        backgroundColor: "#0f172a",
        textColor: "#f8fafc",
      },
    },
    {
      type: "Repeater",
      props: {
        id: "repeater-1",
        source: { $bind: "collection", from: "blog", sortBy: "date", order: "desc", limit: 2 },
        content: [
          {
            type: "ArticleTeaser",
            props: {
              id: "teaser-1",
              title: { $bind: "item.title" },
              date: { $bind: "item.date" },
              excerpt: { $bind: "item.excerpt" },
              url: { $bind: "item.url" },
              accentColor: "#2563eb",
            },
          },
        ],
      },
    },
    {
      type: "Footer",
      props: {
        id: "footer-1",
        siteName: "Démo Puck SSG",
        tagline: "Généré par ssg-src/renderer.jsx",
        links: [],
        copyright: "",
        backgroundColor: "#0f172a",
        textColor: "#e2e8f0",
      },
    },
  ],
};

// Gabarits minimaux pour les routes hors accueil — aucun composant de la palette ne
// bind encore sur page.body/item.body (voir docstring de renderer.jsx), donc pas de
// rendu de corps Markdown ici : seulement la coquille Nav + Footer, suffisant pour
// vérifier que ces routes se génèrent sans erreur.
const shellTemplate = {
  root: { props: {} },
  content: [
    {
      type: "Nav",
      props: { id: "nav-1", items: { $bind: "site.nav" }, variant: "horizontal", backgroundColor: "#0f172a", textColor: "#f8fafc" },
    },
    {
      type: "Footer",
      props: { id: "footer-1", siteName: "Démo Puck SSG", tagline: "", links: [], copyright: "", backgroundColor: "#0f172a", textColor: "#e2e8f0" },
    },
  ],
};

async function main() {
  const { files: output } = await buildSite({
    files,
    title: "Démo Puck SSG",
    baseUrl: "https://demo.stamp-cms.test/",
    templates: {
      home: homeTemplate,
      page: shellTemplate,
      blogIndex: shellTemplate,
      article: shellTemplate,
    },
  });

  await mkdir(OUT_DIR, { recursive: true });
  for (const [filePath, content] of Object.entries(output)) {
    const fullPath = new URL(filePath, OUT_DIR);
    await mkdir(path.dirname(fullPath.pathname), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }

  console.log(`${Object.keys(output).length} fichiers écrits dans ${OUT_DIR.pathname}`);
  for (const filePath of Object.keys(output).sort()) {
    console.log(` - ${filePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
