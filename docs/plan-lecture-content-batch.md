# Plan : lecture de `content/` en un seul appel réseau par fournisseur

## Contexte

Aujourd'hui, `walkContentFiles()` (`site-builder.js:165`) fait 1 appel `listTree` puis
N appels `getBlob` en parallèle (un par fichier `.md`) — utilisé par `fetchContentFiles`
(build du site) et `listContentPages` (écran "pages du site"). On veut réduire ça à un
seul appel réseau, si possible pour chaque fournisseur.

Trois pistes ont été vérifiées en direct (curl, en-têtes CORS) :

| Fournisseur | Piste | CORS | Verdict |
|---|---|---|---|
| Forgejo/Codeberg | `/archive/{ref}.tar.gz` | `access-control-allow-origin: *` confirmé | **Faisable** |
| GitLab | `/projects/:id/repository/archive.tar.gz` | `access-control-allow-origin: *` confirmé | **Faisable** |
| GitHub | `/tarball/{ref}` → redirige vers `codeload.github.com` | `access-control-allow-origin: https://render.githubusercontent.com` (pas notre origine) | **Bloqué**, pas de contournement sans backend |
| GitHub | GraphQL `api.github.com/graphql`, requête batchée (un alias par fichier) | `access-control-allow-origin: *` confirmé | **Faisable** (alternative à l'archive) |

Le README (section "Pistes explorées et mises de côté") documentait déjà l'archive
tar.gz comme explorée-puis-écartée, au motif que Forgejo et GitHub devaient partager
le même chemin de code. Ce plan change ce calcul : on assume l'asymétrie par
fournisseur (2 sur 3 passent à l'archive, GitHub à GraphQL), parce que le gain — 1
requête au lieu de N, y compris pour GitLab dont le `listTree` actuel est déjà
paginé en interne — justifie la divergence.

## Approche

Chaque client API expose une méthode de même nom, `fetchContentBlobs(owner, repo, ref)`,
qui retourne directement `{ "content/x.md": "texte décodé", ... }` — comme les autres
méthodes déjà asymétriques entre clients (`saveFile`, `createBranch`, etc., voir les
commentaires en tête de `github-api.js`). `site-builder.js` n'a plus besoin de
`walkContentFiles`/`getBlob` : `fetchContentFiles` et `listContentPages` appellent
`api.fetchContentBlobs(owner, repo, "main")` et appliquent leur logique actuelle
(`ensureFrontMatter`, extraction de titre, exclusion des `_index.md`) sur le résultat.

### Nouveau module partagé `tar-utils.js`

Chargé comme les autres, simple balise `<script>` dans `index.html`, pas de build.

- `parseTarGz(arrayBuffer) -> Map<path, Uint8Array>` : `DecompressionStream("gzip")`
  natif + parseur tar maison (en-têtes USTAR 512 octets, support PAX pour chemins
  longs si nécessaire).
- Piège à gérer : les archives Forgejo/GitLab préfixent chaque chemin par un dossier
  racine (`{repo}-{ref}-{shortsha}/` ou équivalent) — il faut détecter/retirer ce
  préfixe avant de filtrer sur `content/*.md`.

### `ForgejoApi.fetchContentBlobs` (`api.js`) et `GitLabApi.fetchContentBlobs` (`gitlab-api.js`)

`fetch` de l'endpoint archive respectif, `parseTarGz`, filtrage `content/*.md`,
décodage UTF-8 via `TextDecoder` directement sur les bytes bruts (pas de base64 ici,
contrairement à `decodeBase64Utf8`). Remplace `listTree` + `getBlob` entièrement pour
ces deux fournisseurs — pour GitLab, supprime aussi la pagination interne actuelle du
`listTree`.

### `GitHubApi.fetchContentBlobs` (`github-api.js`)

Garde `listTree` (déjà 1 appel), puis un seul `POST /graphql` avec un alias
`object(expression: "{ref}:{path}")` par fichier trouvé dans l'arbre, au lieu de N
`getBlob`. Point d'attention à trancher en implémentation : la limite de coût de
requête GraphQL GitHub sur un très grand nombre de fichiers (chunker en plusieurs
requêtes si besoin — reste très inférieur à l'actuel 1-par-fichier).

### Déploiement

Ajouter `tar-utils.js` à la fois dans `index.html` (balise `<script>`) et dans
`.github/workflows/deploy-pages.yml` (même liste que
`providers.js`/`github-api.js`/`gitlab-api.js`, voir commit `9509bcc`).

### README

Mettre à jour la section "Pistes explorées et mises de côté" : retirer la piste
tar.gz de la liste des idées écartées (elle est adoptée), documenter la nouvelle
asymétrie Forgejo/GitLab (archive) vs GitHub (GraphQL) et pourquoi.

## Fichiers touchés

- `tar-utils.js` (nouveau) — parseur tar+gzip partagé
- `api.js` — `ForgejoApi.fetchContentBlobs`, retrait de `listTree`/`getBlob` si plus
  appelés ailleurs (vérifier)
- `gitlab-api.js` — `GitLabApi.fetchContentBlobs`, retrait de la pagination `listTree`
  si plus appelée ailleurs
- `github-api.js` — `GitHubApi.fetchContentBlobs` (GraphQL batché), garde `listTree`
- `site-builder.js` — `fetchContentFiles`/`listContentPages` appellent
  `api.fetchContentBlobs`, suppression de `walkContentFiles`
- `index.html`, `.github/workflows/deploy-pages.yml` — inclusion de `tar-utils.js`
- `README.md` — mise à jour "Pistes explorées et mises de côté"

## Vérification

- Suite e2e existante (`npm run e2e`) : couvre déjà publish + lecture de contenu sur
  Forgejo (seed Docker) — valide `ForgejoApi.fetchContentBlobs` de bout en bout.
- Test manuel GitHub/GitLab (pas de conteneur e2e pour ces fournisseurs) : créer/
  utiliser un dépôt de test réel sur chaque plateforme, vérifier que "pages du site"
  et "Publier" fonctionnent identiquement à avant.
- Vérifier au passage le cas `tree.truncated` (gros dépôt) : l'archive n'a pas cette
  limite de pagination, donc ce garde-fou devient obsolète pour Forgejo/GitLab —
  confirmer qu'il n'y a pas d'équivalent "archive tronquée" à gérer côté GitHub (le
  `listTree` GitHub garde son check `truncated` existant).
