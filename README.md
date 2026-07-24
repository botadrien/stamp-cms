# CMS Statique

## Ambition

Remplacer WordPress par un CMS **100% front**, sans serveur à héberger ni à maintenir.
Inspiré de [Decap CMS](https://decapcms.org/) et [Tina CMS](https://tina.io/), mais
pensé pour des personnes **non techniques qui ne savent pas ce qu'est Git** — là où
Decap et Tina restent conçus par et pour des développeurs, et laissent transparaître
la mécanique Git (branches, commits...).

L'objectif : un outil gratuit (hébergement 100% statique) et plus sûr que WordPress
(pas de serveur à patcher, pas de base de données à sécuriser).

## Principes clés

- **Zéro serveur** : le CMS lui-même est une application JS statique, déployable sur
  GitHub Pages / Netlify / Codeberg Pages, comme le site qu'il édite.
- **Git caché** : authentification OAuth2 + PKCE vers un fournisseur Git (Codeberg en
  premier — confirmé compatible PKCE côté client public, donc pas besoin de secret ni
  de fonction serveur relais, contrairement à ce que faisait historiquement Decap+GitHub
  via un pont Netlify).
- **Droits d'accès** = rôles natifs du fournisseur Git (lecture / écriture / admin),
  pas de système de permissions maison.
- **Contenu en Markdown**, source de vérité dans le dépôt Git, édité via un éditeur
  visuel type Notion/Docs (probablement [BlockNote.js](https://www.blocknote.js.org/),
  sur [ProseMirror](https://prosemirror.net/) — la brique utilisée par Docs, la suite
  numérique française). Pour commencer : texte riche, images, tableaux — pas de
  mise en page façon Wix.
- **Génération du site** via [Zola](https://www.getzola.org/), compilé en WebAssembly et
  exécuté **dans le navigateur** à chaque publication (voir "Génération du site (Zola en
  WebAssembly)" ci-dessous) — pas de pipeline CI, pour rester cohérent avec "zéro
  serveur" et "aucune configuration technique pour l'utilisateur·rice".
- **Modularité dès le départ** : API d'extension stable en vue d'une marketplace de
  plugins et de thèmes, pensée tôt pour éviter un refactor douloureux plus tard.

## Plan d'attaque

Valider brique par brique, en commençant par la plus risquée :

1. **Auth OAuth2+PKCE vers Codeberg** — en cours, voir ci-dessous : login sans serveur,
   liste des dépôts, lecture/écriture d'un fichier Markdown via commit direct.
2. **Éditeur riche (BlockNote.js)** — en cours, voir ci-dessous : conversion en
   Markdown → écriture dans le dépôt via l'API.
3. **Génération + publication automatique du site (Zola en WebAssembly)** — en cours,
   voir ci-dessous : à chaque "Publier", tout le site est régénéré (mise en page, nav
   entre pages) et publié sur la branche `pages`, sans CI.
4. Ensuite seulement : gestion des médias, support multi-fournisseur Git (GitLab,
   GitHub...) via une couche d'abstraction commune, système de plugins/thèmes.

## Tester en local

Le POC (`index.template.html`, `config.js`, `pkce.js`, `auth.js`, `api.js`, `app.js`,
`site-builder.js`) couvre le login OAuth+PKCE, la liste des dépôts, et la lecture/écriture
d'un fichier Markdown via commit direct, avec un éditeur riche (BlockNote.js, voir
`editor-src/editor.jsx`) plutôt que du Markdown brut.

BlockNote (React + ProseMirror + Mantine) est trop imbriqué pour être chargé fiablement
via des `<script>`/CDN sans bundler (duplication de singletons ProseMirror entre le point
d'entrée principal et ses sous-modules) — un petit build esbuild (`npm run build`)
produit `editor.bundle.js`/`.css`. Ce même build génère aussi `index.html` à partir de
`index.template.html` (le fichier à éditer — `index.html` est généré, gitignore) en
ajoutant un `?v=<hash du commit>` à chaque script/style local, pour que les navigateurs
(ou un CDN devant Codeberg Pages) rechargent bien les fichiers après un déploiement au
lieu de resservir une version périmée en cache. Le reste de l'app reste des scripts
classiques sans build.

### Génération du site (Zola en WebAssembly)

À la création d'un site et à chaque "Publier", tout le site (config + templates fixes +
tout le Markdown sous `content/`) est **rebuildé avec [Zola](https://www.getzola.org/)
réellement compilé en WebAssembly**, exécuté en mémoire dans le navigateur (aucun fichier
réel touché, aucun serveur), puis chaque fichier HTML produit est publié sur la branche
`pages`. C'est un vrai générateur de site statique — mise en page partagée, navigation
entre pages générée automatiquement par les fonctions Tera de Zola (`section.pages`,
`get_section`), résolution des liens internes — pas un export page par page fait main.

Deux pistes explorées et écartées avant ça, pour référence :
- **Pipeline CI (Codeberg/Forgejo Actions + Eleventy)** — l'architecture "normale" pour un
  générateur de site. Écartée : Forgejo Actions est désactivé par défaut par dépôt
  (activation manuelle dans Settings > Units), et l'alternative Woodpecker CI de Codeberg
  nécessite de remplir un formulaire et d'attendre la validation manuelle d'un·e
  bénévole — incompatible avec "aucune configuration technique pour l'utilisateur·rice".
- **Hugo compilé en WebAssembly** — écarté après un vrai essai : Hugo compile mais son
  pipeline d'assets (Sass) dépend de `os/exec` pour appeler un binaire Dart Sass externe,
  ce qu'un bac à sable WebAssembly ne permet pas (aucun lancement de process).

Zola a fonctionné parce que son build (`getzola/zola`, patché sur la branche `wasm` d'un
fork, voir [ce billet](https://dstaley.com/posts/running-zola-on-wasm/)) ne dépend
d'aucun process externe : rayon (parallélisme) désactivé, `canonicalize()` contourné
(non supporté par WASI), et Sass compilé par `grass` (Rust pur) plutôt que par
LibSass/Dart Sass. Le binaire (`vendor/zola.wasm`, ~15 Mo, commité tel quel car sa
compilation demande un toolchain Rust + wasi-sdk trop lourd pour `npm run build` — voir
`scripts/build-zola-wasm.sh` pour le reconstruire) tourne dans le navigateur via
[`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim), avec un
système de fichiers entièrement en mémoire (voir `editor-src/zola-builder.js`).

1. Crée une OAuth App sur Codeberg (**Settings → Applications**), en **décochant
   "Confidential Client"** (client public, sans secret, requis pour PKCE), avec un
   Redirect URI qui correspond exactement à l'URL de déploiement (ex.
   `http://localhost:8080/` en local).
2. Colle le `clientId` généré dans `config.js`.
3. Installe les dépendances et sers le dossier (obligatoire — `file://` casse `fetch` et
   `crypto.subtle`, et OAuth n'accepte pas les chemins locaux comme Redirect URI) :
   ```bash
   npm install
   make run
   ```
4. Va sur `http://localhost:8080/`, connecte-toi, ouvre un dépôt, édite/crée un
   fichier `.md` et enregistre — ça doit produire un vrai commit sur Codeberg.

## Tests e2e (Forgejo local)

Plutôt que de mocker les appels API, les tests e2e (`e2e/`) font tourner une vraie
instance [Forgejo](https://forgejo.org/) en local via Docker et pilotent un vrai
navigateur (Playwright) à travers le flow complet : login OAuth2+PKCE réel (formulaire
de connexion, écran de consentement), édition et commit d'un fichier — vérifié ensuite
via l'API Forgejo elle-même.

```bash
npm install
npm run e2e        # up (Forgejo + seed) + tests + down, tout en un
```

Ou étape par étape (utile pour déboguer) :

```bash
npm run e2e:up     # démarre Forgejo, crée un user/app OAuth2/dépôt de test (e2e/seed.mjs)
npm run e2e:test   # lance les tests Playwright (démarre aussi le serveur statique du POC)
npm run e2e:down   # arrête et nettoie
```

Point notable découvert en construisant ces tests : Codeberg répond aux requêtes
cross-origin (CORS) sur `/login/oauth/access_token` et sur `/api/v1/*` avec les en-têtes
`Access-Control-Allow-Origin` — sans quoi le POC casserait en `Failed to fetch` — mais
Forgejo vanilla ne le fait pas nativement sur ces routes. `e2e/Caddyfile` reproduit ce
comportement via un reverse proxy devant Forgejo, pour que l'environnement de test colle
au vrai comportement de production.

## Points à trancher / vigilance

- Conflits d'édition simultanée (verrouillage simple vs temps réel type Yjs)
- Sécurité du token OAuth stocké côté navigateur
- Quotas de l'API du fournisseur Git
- Prévisualisation avant publication
- Domaine personnalisé
- Médias dans le dépôt Git : ça marche, mais avec des limites de taille (repos volumineux,
  fichiers individuels plafonnés) — à surveiller si beaucoup de photos/vidéos
- Rester multi-fournisseur à terme sans complexifier le MVP

## État de l'art

- **Decap CMS / Tina CMS** — CMS Git, mais orientés développeurs
- **Sveltia CMS** — successeur spirituel de Decap, UI plus moderne, config toujours technique
- **Publii** — non-dev-friendly mais app desktop à installer, pas 100% web
- **GitCMS** (open source, éditeur TipTap) et **gitcms.dev** (service commercial, mais
  passe par une GitHub App donc nécessite un backend — hors scope ici)
