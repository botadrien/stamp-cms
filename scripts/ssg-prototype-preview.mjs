// Tâche 10 (voir docs/plan-puck-ssg.md, "Point de contrôle prototype") : construit un
// site de démo avec le renderer Puck (ssg-src/renderer.jsx) et les gabarits Puck PAR
// DÉFAUT (ssg-src/default-templates.js — ceux réellement utilisés par site-builder.js en
// prod, voir buildSiteFiles()) à partir d'un contenu Markdown fixture, et écrit le
// résultat HTML/XML dans tmp/ssg-preview/ — pour vérifier à l'œil (et par un serveur
// statique local) que bindings + collections + slot API de Puck + rendu du corps de
// page/article coopèrent bien sur un cas représentatif, avant de publier depuis l'app.
//
// Fichiers *.jsx importés directement : ce script n'est pas exécuté tel quel par Node
// (JSX non supporté nativement) mais bundlé au préalable avec esbuild :
//   npx esbuild scripts/ssg-prototype-preview.mjs --bundle --platform=node \
//     --format=esm --packages=external --jsx=automatic --outfile=tmp/ssg-preview-bundle.mjs
//   node tmp/ssg-preview-bundle.mjs

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSite } from "../ssg-src/renderer.jsx";
import { defaultTemplates } from "../ssg-src/default-templates.js";

const OUT_DIR = new URL("../tmp/ssg-preview/", import.meta.url);

// Contenu fixture, même forme que fetchContentFiles() (site-builder.js) :
// { "content/xxx.md": "texte front matter + corps" }.
const files = {
  "content/_index.md": `+++
title = "Démo Puck SSG"
+++
`,
  "content/a-propos.md": `+++
title = "À propos"
+++

Ceci est une page fixture pour le point de contrôle prototype — son corps doit
apparaître tel quel sur sa page publiée, via le composant **PageContent**.
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
scoped par item — c'est ce que la page d'accueil utilise pour lister les derniers
articles.
`,
};

async function main() {
  const { files: output } = await buildSite({
    files,
    title: "Démo Puck SSG",
    baseUrl: "https://demo.stamp-cms.test/",
    templates: defaultTemplates,
  });

  await mkdir(OUT_DIR, { recursive: true });
  for (const [filePath, content] of Object.entries(output)) {
    const fullPath = new URL(filePath, OUT_DIR);
    await mkdir(path.dirname(fullPath.pathname), { recursive: true });
    await writeFile(fullPath, content);
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
