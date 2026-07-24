// Génère index.html à partir de index.template.html en ajoutant un paramètre de
// version (?v=...) à chaque asset local, pour éviter que les navigateurs (ou un CDN
// devant Codeberg Pages) ne resservent une version périmée de app.js/editor.bundle.js
// après un déploiement. index.html est généré (gitignore) — on édite le template.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

function buildVersion() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return String(Date.now());
  }
}

const version = buildVersion();
const template = readFileSync("index.template.html", "utf-8");

// Ne touche qu'aux assets locaux (pas de "://"), en ajoutant ?v=<version>.
const html = template.replace(
  /(src|href)="([^"]+\.(?:js|css))"/g,
  (match, attr, url) => (url.includes("://") ? match : `${attr}="${url}?v=${version}"`)
);

writeFileSync("index.html", html);
console.log(`index.html généré (version ${version})`);
