// Lance Zola (vendor/zola.wasm, voir scripts/build-zola-wasm.sh) entièrement en
// mémoire dans le navigateur — aucun fichier réel touché, aucun serveur — via
// @bjorn3/browser_wasi_shim. Bundlé en IIFE sur window.ZolaBuilder (voir editor.jsx pour
// le même principe côté éditeur riche).
import { WASI, File, Directory, OpenFile, ConsoleStdout, PreopenDirectory } from "@bjorn3/browser_wasi_shim";

let cachedWasmModule = null;

async function loadWasmModule(wasmUrl) {
  if (!cachedWasmModule) {
    cachedWasmModule = await WebAssembly.compileStreaming(fetch(wasmUrl));
  }
  return cachedWasmModule;
}

// { "config.toml": "...", "content/_index.md": "...", "static/font.woff2": Uint8Array }
// -> arbre de Directory/File imbriqués, tel qu'attendu par PreopenDirectory. Une valeur
// chaîne est encodée en UTF-8 (contenu qu'on génère nous-mêmes : config, contenu,
// templates) ; un Uint8Array est utilisé tel quel (assets binaires du thème — polices,
// icônes — dont l'encodage ne doit pas être réinterprété).
function buildInputTree(files) {
  const root = new Map();
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      let entry = dir.get(name);
      if (!(entry instanceof Directory)) {
        entry = new Directory(new Map());
        dir.set(name, entry);
      }
      dir = entry.contents;
    }
    const bytes = content instanceof Uint8Array ? content : new TextEncoder().encode(content);
    dir.set(parts[parts.length - 1], new File(bytes));
  }
  return root;
}

// Aplatit récursivement un Directory (typiquement le sous-dossier "public" produit par
// Zola) en { "index.html": Uint8Array, "sub/page.html": Uint8Array, ... }. Toujours des
// octets bruts, jamais décodés : la sortie mélange du HTML/CSS généré (texte) et des
// assets statiques recopiés tels quels par Zola (polices, icônes) — décoder en UTF-8
// corromprait ces derniers.
function flattenOutputTree(dir, prefix = "") {
  const out = {};
  for (const [name, entry] of dir.contents) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry instanceof Directory) {
      Object.assign(out, flattenOutputTree(entry, path));
    } else if (entry instanceof File) {
      out[path] = entry.data;
    }
  }
  return out;
}

// files : contenu d'entrée (config.toml, content/*.md, templates/*.html).
// Retourne { files: <sortie de public/>, log: <stdout+stderr de zola> }.
export async function buildSite(files, { wasmUrl = "vendor/zola.wasm" } = {}) {
  const wasmModule = await loadWasmModule(wasmUrl);

  const logLines = [];
  const inputTree = buildInputTree(files);
  const rootDir = new Directory(inputTree);
  const preopen = new PreopenDirectory(".", inputTree);

  const fds = [
    new OpenFile(new File([])),
    ConsoleStdout.lineBuffered((line) => logLines.push(line)),
    ConsoleStdout.lineBuffered((line) => logLines.push(line)),
    preopen,
  ];
  const wasi = new WASI(["zola", "--root", "/", "build", "--output-dir", "/public"], [], fds);

  const instance = await WebAssembly.instantiate(wasmModule, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  let exitCode = 0;
  try {
    exitCode = wasi.start(instance);
  } catch (err) {
    // wasi-shim jette WASIProcExit dans certains cas plutôt que de retourner le code.
    exitCode = err && typeof err.code === "number" ? err.code : 1;
  }

  const log = logLines.join("\n");
  if (exitCode !== 0) {
    const err = new Error("Échec de la génération du site");
    err.log = log;
    throw err;
  }

  const publicDir = rootDir.contents.get("public");
  if (!(publicDir instanceof Directory)) {
    const err = new Error("Zola n'a produit aucun fichier (dossier public introuvable)");
    err.log = log;
    throw err;
  }

  return { files: flattenOutputTree(publicDir), log };
}
