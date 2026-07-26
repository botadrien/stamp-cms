// Cache local (IndexedDB) de tout le contenu d'un dépôt (thème + content/), pour éviter
// de retélécharger l'intégralité du repo à chaque écran/navigation dans le même site.
// Voir le plan "Refonte lecture repo" pour le contexte : chaque client API expose
// fetchRepoArchive(owner, repo, ref) -> { chemin: Uint8Array } (archive tar.gz pour
// Forgejo/GitLab, GraphQL batché pour GitHub) ; ce module n'est que la couche cache
// par-dessus, indépendante du fournisseur.
//
// Pas localStorage (écarté : quota ~5-10 Mo/origine, API synchrone bloquante, chaînes de
// caractères seulement — inadapté aux assets binaires du thème). IndexedDB : async, quota
// bien plus large, stocke nativement des Uint8Array.

const REPO_CACHE_DB_NAME = "cmstatic-repo-cache";
const REPO_CACHE_DB_VERSION = 1;
const REPO_CACHE_STORE = "repos";

let repoCacheDbPromise = null;

function openRepoCacheDb() {
  if (repoCacheDbPromise) return repoCacheDbPromise;
  repoCacheDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(REPO_CACHE_DB_NAME, REPO_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      // Clé passée explicitement à put()/get() (voir repoCacheKey ci-dessous), pas de
      // keyPath : la valeur stockée ({headSha, files}) n'a pas besoin de porter sa
      // propre clé.
      request.result.createObjectStore(REPO_CACHE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return repoCacheDbPromise;
}

function repoCacheKey(owner, repo) {
  return `${owner}/${repo}`;
}

function readRepoCacheEntry(owner, repo) {
  return openRepoCacheDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(REPO_CACHE_STORE, "readonly").objectStore(REPO_CACHE_STORE).get(repoCacheKey(owner, repo));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      })
  );
}

function writeRepoCacheEntry(owner, repo, entry) {
  return openRepoCacheDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(REPO_CACHE_STORE, "readwrite");
        tx.objectStore(REPO_CACHE_STORE).put(entry, repoCacheKey(owner, repo));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

// Retourne { chemin: Uint8Array } pour tout le dépôt (branche main). Ne retélécharge que
// si le sha HEAD distant a changé depuis le dernier passage (ou si rien n'est en cache) —
// sinon sert directement la copie locale, zéro requête réseau de contenu.
async function getRepoFiles(owner, repo, api) {
  const headSha = await api.getHeadSha(owner, repo, "main");
  const cached = await readRepoCacheEntry(owner, repo);
  if (cached && cached.headSha === headSha) return cached.files;

  const files = await api.fetchRepoArchive(owner, repo, "main");
  await writeRepoCacheEntry(owner, repo, { headSha, files });
  return files;
}

// Appelé après toute écriture sur main (sauvegarde de page ou de template, installation
// du thème...) : purge la copie locale pour que le prochain getRepoFiles() revérifie le
// sha distant au lieu de servir en silence une copie périmée dans la même session.
async function invalidateRepoCache(owner, repo) {
  const db = await openRepoCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REPO_CACHE_STORE, "readwrite");
    tx.objectStore(REPO_CACHE_STORE).delete(repoCacheKey(owner, repo));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
