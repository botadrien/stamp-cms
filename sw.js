// Sert l'aperçu en direct de l'éditeur : app.js poste ici la sortie d'un build Zola en
// mémoire (voir buildPreviewSite() dans site-builder.js), et ce worker la ressert sous
// /preview/<owner>/<repo>/... avec de vraies URLs relatives (nav entre pages, CSS,
// images...) — un iframe en srcdoc/blob URL ne le permettrait pas. Tout le reste (assets
// de l'appli, API Codeberg cross-origin) passe au réseau sans interception.
// Relatif au scope du worker (répertoire de sw.js), pas à la racine du domaine — l'appli
// peut être déployée sous un sous-chemin (voir config.js, ex. .../cms-poc/) et le worker
// n'intercepte de toute façon rien en dehors de son scope.
const PREVIEW_PREFIX = new URL("preview/", self.registration.scope).pathname;

// key: "owner/repo" -> Map(path -> Uint8Array), remplacée en entier à chaque build.
const previewSites = new Map();

const MIME_TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
};

function mimeType(path) {
  const ext = path.split(".").pop().toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const { type, owner, repo, files } = event.data || {};
  if (type !== "update-preview") return;
  previewSites.set(`${owner}/${repo}`, new Map(Object.entries(files)));
  // Accusé de réception : postMessage() revient avant que ce handler tourne, donc
  // l'appelant (app.js) doit attendre ce message avant de naviguer l'iframe — sinon la
  // requête /preview/... peut arriver avant que la map ci-dessus soit à jour (404
  // intermittent, observé en e2e).
  event.ports[0]?.postMessage({ ok: true });
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(PREVIEW_PREFIX)) return; // pas de respondWith : réseau normal

  const rest = url.pathname.slice(PREVIEW_PREFIX.length);
  const [rawOwner, rawRepo, ...pathParts] = rest.split("/");
  const owner = decodeURIComponent(rawOwner || "");
  const repo = decodeURIComponent(rawRepo || "");

  let key = pathParts.join("/");
  if (key === "" || key.endsWith("/")) key += "index.html";

  const files = previewSites.get(`${owner}/${repo}`);
  const bytes = files && files.get(key);
  if (!bytes) {
    event.respondWith(new Response("Aperçu introuvable — republie un changement.", { status: 404 }));
    return;
  }
  event.respondWith(new Response(bytes, { headers: { "Content-Type": mimeType(key) } }));
});
