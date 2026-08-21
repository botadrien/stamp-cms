// Injecté (esbuild --inject) dans ssg-builder.bundle.js uniquement : gray-matter (utilisé
// par ssg-src/content-loader.js) appelle Buffer.from() sans condition dans to-file.js pour
// garder une copie brute du contenu (file.orig) — global Node absent des navigateurs, et
// esbuild ne le polyfille pas automatiquement pour une cible browser. `buffer` (npm) est le
// polyfill de référence pour ce cas ; poser Buffer en global avant que gray-matter ne
// tourne évite de forker/patcher la lib pour un seul appel non essentiel.
import { Buffer } from "buffer";

globalThis.Buffer = Buffer;
