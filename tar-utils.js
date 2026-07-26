// Parseur tar+gzip minimal pour les archives /archive/{ref}.tar.gz (Forgejo, GitLab —
// voir docs/plan-lecture-content-batch.md et le plan "Refonte lecture repo" pour le
// contexte : CORS ouvert sur ces endpoints, contrairement au tarball GitHub). Pas une
// implémentation complète du format tar (ignore hardlinks/symlinks/devices, inutiles
// ici) — juste de quoi lire ce que `git archive` produit côté Forgejo/GitLab.
// Retourne un objet { chemin: Uint8Array }, comme partout ailleurs dans le code
// (voir loadThemeFiles dans site-builder.js) plutôt qu'une Map, pour rester
// interchangeable avec ces autres sources de fichiers.

async function parseTarGz(arrayBuffer) {
  const stream = new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return parseTar(decompressed);
}

function readOctalField(header, offset, length) {
  const str = new TextDecoder()
    .decode(header.subarray(offset, offset + length))
    .replace(/\0.*$/, "")
    .trim();
  return str ? parseInt(str, 8) : 0;
}

function readStringField(header, offset, length) {
  const slice = header.subarray(offset, offset + length);
  const nul = slice.indexOf(0);
  return new TextDecoder().decode(nul === -1 ? slice : slice.subarray(0, nul));
}

// En-tête étendu PAX (typeflag "x") : suite de lignes "<longueur> <clé>=<valeur>\n" où
// <longueur> compte la ligne entière. git archive s'en sert notamment pour les chemins
// trop longs pour les 100+155 octets du format ustar classique.
function parsePaxHeader(data) {
  const text = new TextDecoder().decode(data);
  const fields = {};
  let pos = 0;
  while (pos < text.length) {
    const spaceIdx = text.indexOf(" ", pos);
    if (spaceIdx === -1) break;
    const len = parseInt(text.slice(pos, spaceIdx), 10);
    if (!len) break;
    const eq = text.indexOf("=", spaceIdx + 1);
    fields[text.slice(spaceIdx + 1, eq)] = text.slice(eq + 1, pos + len - 1); // -1 : \n final
    pos += len;
  }
  return fields;
}

// git archive enveloppe toujours le contenu dans un dossier racine
// ("{repo}-{shortsha}/...") — on le retire pour retomber sur les chemins réels du
// dépôt (content/..., templates/...).
function stripRootPrefix(files) {
  const paths = Object.keys(files);
  if (!paths.length) return files;
  const firstSegment = paths[0].split("/")[0];
  if (!paths.every((p) => p.startsWith(`${firstSegment}/`))) return files;

  const stripped = {};
  for (const [path, bytes] of Object.entries(files)) {
    stripped[path.slice(firstSegment.length + 1)] = bytes;
  }
  return stripped;
}

function parseTar(bytes) {
  const files = {};
  let offset = 0;
  let pendingPaxPath = null;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break; // bloc d'en-tête vide = fin d'archive

    const size = readOctalField(header, 124, 12);
    const typeflag = String.fromCharCode(header[156]);
    const data = bytes.subarray(offset + 512, offset + 512 + size);

    if (typeflag === "x") {
      const fields = parsePaxHeader(data);
      if (fields.path) pendingPaxPath = fields.path;
    } else if (typeflag === "0" || typeflag === "\0") {
      let name = pendingPaxPath;
      if (!name) {
        const prefix = readStringField(header, 345, 155);
        const base = readStringField(header, 0, 100);
        name = prefix ? `${prefix}/${base}` : base;
      }
      pendingPaxPath = null;
      files[name] = new Uint8Array(data); // copie hors du buffer partagé
    } else {
      pendingPaxPath = null; // dossier/lien/etc. ignoré, ne doit pas fuiter sur l'entrée suivante
    }

    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return stripRootPrefix(files);
}
