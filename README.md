# Stamperia

## WordPress, sans le serveur.

Un CMS qui tourne **entièrement dans votre navigateur** — l'édition du contenu et la génération du site.

Gratuit à 100% et toujours :
- aucun serveur à héberger (et payer) comme pour Wordpress
- le site compilé est hébergé sur une plateforme gratuite comme Codeberg Pages.
- plus sécurisé, pas de mise à jour à faire !

**[Démo en ligne](https://botadrien.github.io/cmstatic/)** — déployée automatiquement sur GitHub Pages à chaque push (voir `.github/workflows/deploy-pages.yml`).
> Note : la connexion sur cette démo suppose que `https://botadrien.github.io/cmstatic/` soit déclarée comme Redirect URI de l'application OAuth2 correspondante sur codeberg.org (réglage manuel, une seule fois — voir `config.js`).

![Édition d'une page avec aperçu en direct du site généré par Zola, côte à côte](docs/screenshots/live-preview.png)

## Fonctionnalités

- **Connexion sans serveur** : OAuth2 + PKCE directement vers Codeberg ou GitLab (pas besoin de bridge), ou jeton d'accès personnel collé à la main pour GitHub (voir "Forges git" ci-dessous pour pourquoi GitHub n'a pas droit au même flow OAuth). Droits d'accès = rôles natifs du fournisseur choisi.
- **Multi-fournisseur** : Codeberg, GitHub et GitLab (gitlab.com uniquement, pas de self-hosted), via une couche d'abstraction commune (`api.js`/`github-api.js`/`gitlab-api.js`/`providers.js`) pensée pour qu'ajouter un fournisseur de plus n'exige pas de refonte.
- **Édition riche** : éditeur visuel similaire à Notion ([BlockNote.js](https://www.blocknote.js.org/) sur [ProseMirror](https://prosemirror.net/))
  Contenu stocké en Markdown, source de vérité dans le dépôt Git, commit direct à chaque enregistrement.
- **Génération du site** avec [Zola](https://www.getzola.org/), compilé en WebAssembly et exécuté **dans le navigateur** à chaque publication.
- **Aperçu en direct** : pendant l'édition, un volet à côté de l'éditeur montre le site réellement généré par Zola (nav, thème, mise en page) à partir du brouillon en cours — rien n'est publié tant qu'on n'a pas cliqué sur "Publier".
- **Publication en un clic** : chaque "Publier" compile le site et le publie sur la branche `pages` du dépôt.
- **Contenu structuré** : pages et articles de blog gérés séparément (triés par date pour le blog), écran "Réglages du site" pour le titre du blog.
- **Suppression d'un site** : depuis "Réglages du site", zone dangereuse qui supprime le dépôt entier chez le fournisseur (irréversible, il faut retaper le nom du dépôt pour confirmer).
- **Thème** : un thème vendoré, volks-typo, copié dans le dépôt de chaque site à sa création (choix de thème prévu plus tard, voir "Roadmap") — voir "Lecture du dépôt : archive complète + cache local" et "Thème copié dans chaque site" plus bas pour l'architecture.
- **Templates** : onglet dédié pour éditer le code (HTML/Tera) des gabarits du thème, avec preview live comme pour le contenu — voir "Thème copié dans chaque site" plus bas.

## Feuille de route

1. **Gestion des médias** (images, etc.) dans le dépôt Git.
2. **Système de plugins/thèmes**, avec une API d'extension stable pensée dès maintenant pour éviter un refactor douloureux plus tard, en vue d'une marketplace de plugins et de thèmes.
3. D'autres fournisseurs derrière la même couche d'abstraction — Codeberg, GitHub et GitLab y sont déjà branchés, voir "Forges git" plus bas.

## État de l'art / Inspirations

- **[Decap CMS](https://decapcms.org/) / [Tina CMS](https://tina.io/)** — CMS Git, mais orientés développeurs
- **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)** — successeur spirituel de Decap, UI plus moderne, config toujours technique
- **[Publii](https://getpublii.com/)** — facile à utiliser sans être développeur·euse. L'app desktop à installer rend la collaboration compliquée.
- **[GitCMS](https://github.com/BestPlayerMMIII/GitCMS)** (open source, éditeur TipTap) et **[gitcms.dev](https://gitcms.dev/)** (service commercial, mais passe par une GitHub App donc nécessite un backend — hors scope ici)
- **[VvvebJs](https://github.com/givanz/VvvebJs)** — édition en place sur le DOM réel, sans preview séparée, vanilla JS sans build tool. Pas réutilisable tel quel (pages HTML statiques, pas de séparation contenu/template, couplé à Bootstrap), mais bonne référence d'architecture pour une édition inline sans framework lourd.

## Développement / Contribuer

### Lancer en local

1. Créer une OAuth App sur Codeberg (**Settings → Applications**), en **décochant "Confidential Client"** , avec comme Redirect URI `http://localhost:8080`
2. Coller le `clientId` généré dans `config.js`
3. `npm install`
4. `make run`
5. Ouvrir `http://localhost:8080/`

Pour se connecter avec GitHub à la place, rien à configurer : générer un jeton d'accès
personnel classique avec les scopes `repo` et `delete_repo` (`delete_repo` requis pour
supprimer un site depuis les réglages — le POC propose un lien direct vers l'écran de
création du jeton, scopes pré-remplis) et le coller sur l'écran de connexion.

Pour se connecter avec GitLab (gitlab.com uniquement) : créer une application sur
[gitlab.com/-/user_settings/applications](https://gitlab.com/-/user_settings/applications)
avec comme Redirect URI `http://localhost:8080`, scope `api` uniquement, et **décocher
"Confidential"** pour forcer PKCE (pas de secret nécessaire). Coller l'"Application ID"
généré dans `gitlabClientId` dans `config.js`.

### Lancer les tests

Plutôt que de mocker les appels API, les tests e2e (`e2e/`) font tourner une vraie instance [Forgejo](https://forgejo.org/) en local via Docker et pilotent un vrai navigateur (Playwright) à travers le flow complet : login OAuth2+PKCE réel (formulaire de connexion, écran de consentement), édition et commit d'un fichier — vérifié ensuite via l'API Forgejo elle-même.

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

Suite e2e GitLab séparée (`npm run e2e:gitlab`) — même principe (vraie instance `gitlab/gitlab-ce`
en Docker, pas de mock), mais **pas incluse dans `npm run e2e` ni dans la CI par défaut** :
l'image GitLab CE est nettement plus lourde/lente à démarrer (plusieurs minutes, contre
~1 min pour Forgejo). À lancer manuellement pour tester le chemin GitLab.


## Points à trancher / vigilance

- Conflits d'édition simultanée (verrouillage simple vs temps réel type [Yjs](https://yjs.dev/))
- Sécurité du token OAuth stocké côté navigateur
- Quotas de l'API du fournisseur Git
- Domaine personnalisé
- Médias dans le dépôt Git : ça marche, mais avec des limites de taille (repos volumineux, fichiers individuels plafonnés) — à surveiller si beaucoup de photos/vidéos
- Rester multi-fournisseur à terme sans complexifier le MVP
- Revenir à un gabarit de thème par défaut (annuler une personnalisation) : pas encore de pattern de suppression de fichier dans les clients API (seulement création/mise à jour) — nécessaire pour ça
- Resynchroniser le thème d'un site avec des correctifs futurs de `themes/volks-typo/` : pas de mécanisme prévu pour l'instant (voir "Thème copié dans chaque site")

## Pistes explorées et mises de côté

### vrai client git en frontend

Une tentative de remplacer l'API REST "contents" de Forgejo par du vrai git (clone/fetch/push en mémoire dans le navigateur, via [isomorphic-git](https://isomorphic-git.org/) + [lightning-fs](https://github.com/isomorphic-git/lightning-fs)) a été menée pour de bon — un seul push au lieu de N requêtes GET/PUT par fichier, et une vraie détection de conflit par fast-forward côté serveur plutôt que le verrou par sha de Forgejo.
Le code fonctionne et est vérifié par la suite e2e complète (voir la branche [`explore/isomorphic-git`](https://github.com/botadrien/cmstatic/tree/explore/isomorphic-git)), mais n'a pas été mergé sur `main` : Codeberg ne renvoie pas d'en-tête CORS sur ses endpoints git smart-HTTP (contrairement à `/api/v1/*`), ce qui oblige à passer par un proxy CORS pour cloner/pousser depuis le navigateur.
Le seul proxy public gratuit (`cors.isomorphic-git.org`) s'est montré trop instable en pratique (erreurs Cloudflare 403/502 constatées aussi bien depuis un environnement de test que depuis une IP résidentielle normale) pour être utilisable en prod telle quelle.
À revisiter si un proxy auto-hébergé devient acceptable, ou si Codeberg ajoute un jour le support CORS sur ces routes.

### Compiler le site dans des actions CI plutôt qu’en frontend

C’est l'architecture "normale" pour un générateur de site statiques : compiler le site dans les GitHub Actions ou Codeberg/Forgejo Actions.
- Avantage : plus simple à mettre en place (pas besoin de compiler en wasm le cli de SSG)
- Avantage : plus rapide que le navigateur
- Avantage : scale probablement mieux
- Inconvénient : on a envie de permettre des prévisualisations live, il faut donc faire tourner le SSG dans le navigateur
- Inconvénient : sur Codeberg les actions ne sont pas automatiquement ouvertes à toustes
- Inconvénient : on veut être autant indépendant que possible de systèmes externes

### [Hugo](https://gohugo.io/) plutôt que Zola

écarté après un vrai essai : Hugo compile en WASM mais son pipeline d'assets (Sass) dépend de `os/exec` pour appeler un binaire Dart Sass externe, ce qu'un bac à sable WebAssembly ne permet pas (aucun lancement de process).

### Réutiliser l'éditeur Gutenberg de WordPress

Idée : reprendre `@wordpress/block-editor` (npm, utilisable hors WordPress via des projets comme [isolated-block-editor](https://github.com/Automattic/isolated-block-editor)) plutôt que redévelopper un éditeur par blocs.
Écarté : licence GPLv2+ (copyleft fort, tension avec une marketplace de plugins/thèmes payants), couplage à une API REST WordPress à démonter, format de sérialisation en HTML à commentaires plutôt que Markdown (contredit "contenu stocké en Markdown" ci-dessus), dépendances plus lourdes que BlockNote.
Et surtout : ça n'évite pas le vrai travail (mapper chaque bloc vers une macro Tera pour le rendu publié) — le rendu WordPress passe par PHP, inutilisable tel quel avec Zola.

## Détails techniques

### Forges git

Codeberg répond aux requêtes cross-origin (CORS) sur `/login/oauth/access_token` et sur `/api/v1/*` avec les en-têtes `Access-Control-Allow-Origin`.
Mais Forgejo vanilla ne le fait pas nativement sur ces routes.
`e2e/Caddyfile` reproduit ce comportement via un reverse proxy devant Forgejo, pour que l'environnement de test colle au vrai comportement de production.

**Pourquoi GitHub n'a pas le même flow OAuth2 + PKCE que Codeberg** : `api.github.com` répond bien en CORS pour tous les appels REST une fois authentifié, mais `github.com/login/oauth/access_token` (l'échange code → token) ne renvoie aucun en-tête CORS, ce qui bloque l'appel depuis un navigateur.
Pire, même avec le support PKCE ajouté par GitHub en 2025, GitHub exige toujours un `client_secret` pour cet échange — un secret qu'on ne peut pas committer dans une appli 100% front sans le rendre public à toustes.
Plutôt qu'un serveur/proxy dédié rien que pour cet échange (qui aurait été le premier serveur requis par ce projet, contraire à son principe fondateur), GitHub se connecte via un jeton d'accès personnel collé à la main — voir `github-api.js`, `providers.js` et `auth.js:loginWithToken`.

**GitLab** (gitlab.com uniquement, pas de self-hosted) a bien droit au flow OAuth2 + PKCE en un clic comme Codeberg : `gitlab.com/oauth/token` renvoie `access-control-allow-origin: *` (vérifié en direct, preflight et réponse réelle), pas de blocage CORS comme sur GitHub.
En revanche GitLab Pages n'a pas d'équivalent du webhook Codeberg ou de l'API Pages GitHub : son API Pages (`GET`/`PATCH`/`DELETE /projects/:id/pages`) ne gère que les réglages (domaine, HTTPS) et la dépublication, aucun endpoint d'upload direct — **un pipeline CI est toujours requis pour publier**, contrairement aux deux autres fournisseurs.
`GitLabApi.enablePublishing()` (`gitlab-api.js`) committe donc une fois un `.gitlab-ci.yml` minimal dont le job ne compile rien : il republie tel quel (via `rsync`) le contenu déjà buildé côté client et présent sur la branche `pages`, pour rester cohérent avec le principe du projet (compilation toujours dans le navigateur, jamais côté serveur/CI).

La couche d'abstraction (`ForgejoApi` dans `api.js`, `GitHubApi` dans `github-api.js`, `GitLabApi` dans `gitlab-api.js`, choix du bon client via `providers.js`) absorbe les différences d'API entre les trois forges : création de branche (un seul appel côté Forgejo/GitLab, lecture de ref + création de ref côté GitHub), activation de la publication (webhook côté Codeberg Pages, appel dédié à l'API Pages côté GitHub, `.gitlab-ci.yml` committé côté GitLab), `PUT` systématique de l'API contents de GitHub là où Forgejo/GitLab distinguent `POST`/`PUT` selon création ou mise à jour, et la détection de conflit d'édition (422 chez Forgejo, 409 chez GitHub, 400 chez GitLab — voir `isConflict()` sur chaque client).
GitLab identifie aussi ses projets par un chemin `owner/repo` URL-encodé en un seul segment d'URL plutôt que deux segments séparés, et pagine son endpoint d'arbre de fichiers (`listTree()`) là où Forgejo/GitHub renvoient tout en un seul appel — détails absorbés par `gitlab-api.js`, voir ses commentaires de tête de fichier.

### Génération du site dans le navigateur

On a compilé [Zola](https://www.getzola.org/) en WASM grace au travail de Dylan Staley cf [ce billet](https://dstaley.com/posts/running-zola-on-wasm/).
C'est possible car on fait en sorte que Zola ne dépend d'aucun process externe : `rayon` (parallélisme) désactivé, `canonicalize()` contourné (non supporté par WASI), et Sass compilé par `grass` (Rust pur) plutôt que par LibSass/Dart Sass.
Le binaire compilé `vendor/zola.wasm` fait ~15 Mo
On le commit tel quel car sa compilation demande un toolchain Rust + wasi-sdk trop lourd pour `npm run build` (cf `scripts/build-zola-wasm.sh`)
Il tourne dans le navigateur via [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim)
On l'utilise avec un système de fichiers entièrement en mémoire (voir `editor-src/zola-builder.js`).

Lors de la publication du site, on l'éxecute navigateur puis chaque fichier compilé (HTML, CSS images) produit est publié sur la branche `pages`.

Chaque site est buildé avec le thème Zola vendoré dans l'app, **volks-typo** (`themes/volks-typo/`, récupéré via `scripts/fetch-theme-volks-typo.sh`) — copié dans le dépôt du site à sa création plutôt que relu depuis l'app à chaque build, voir "Thème copié dans chaque site" ci-dessous pour l'architecture complète et le point d'accroche pour un choix de thème plus tard.

### Lecture du dépôt : archive complète + cache local

`content/` (pages, articles) et `templates/` (thème du site, voir ci-dessous) sont lus ensemble, en un seul aller-retour réseau par fournisseur plutôt qu'un appel par fichier :
- **Forgejo/Codeberg et GitLab** : un appel à l'endpoint d'archive (`/archive/{ref}.tar.gz`, `/repository/archive.tar.gz`), CORS ouvert vérifié en direct sur les deux (`access-control-allow-origin: *`), décompressé et parsé côté navigateur (`DecompressionStream` natif + petit parseur tar maison dans `tar-utils.js`, pas de dépendance zip).
- **GitHub** : l'archive/tarball est bloquée pour un usage navigateur (`/tarball/{ref}` redirige vers `codeload.github.com`, qui ne renvoie `access-control-allow-origin` que pour `render.githubusercontent.com`, vérifié en direct). À la place : un `listTree` (déjà un seul appel) puis **une seule** requête GraphQL groupée (`api.github.com/graphql`, CORS ouvert vérifié) avec un alias par fichier — les fichiers binaires (polices, images du thème) retombent individuellement sur l'API blob REST, le type `Blob` de GraphQL GitHub n'exposant pas de contenu base64 (`text` vaut `null` pour un blob binaire).
- Piège rencontré (et corrigé) sur l'endpoint archive Forgejo : il répond `Cache-Control: private, max-age=300` sur une URL qui ne varie pas avec le commit (`.../archive/main.tar.gz`) — sans `cache: "no-store"` explicite sur le `fetch`, le cache HTTP du navigateur pouvait reservir une archive périmée après deux publications rapprochées (repéré via la suite e2e, page fraîchement publiée absente de la liste juste après).

Le résultat (`{ chemin: Uint8Array }` pour tout le dépôt) est mis en cache localement en **IndexedDB** (`repo-cache.js`) plutôt que retéléchargé à chaque écran : un sha HEAD de branche (appel léger, un par fournisseur) est comparé au sha mis en cache avant de décider de retélécharger ou non — `localStorage` a été écarté (quota ~5-10 Mo/origine, API synchrone bloquante, chaînes de caractères seulement, inadapté aux assets binaires du thème).

### Thème copié dans chaque site

Le thème complet (`themes/volks-typo/`) est copié dans le dépôt de chaque site à sa création (`createSite()` dans `app.js`, même écriture batch qu'une publication), plutôt que relu depuis les assets de l'app à chaque build — chaque site devient un vrai projet Zola autonome. Contrepartie assumée : les correctifs futurs du thème vendoré ne se propagent plus automatiquement aux sites déjà créés (pas de mécanisme de resynchronisation pour l'instant).

Pour les sites créés avant cette fonctionnalité (ou n'ayant personnalisé qu'un seul gabarit) : `getSiteFiles()` (`site-builder.js`) fusionne toujours le thème vendoré de l'app *fichier par fichier* sous ce qui existe réellement dans le dépôt — jamais un tout-ou-rien — pour que lecture et build restent corrects même sur un dépôt partiellement aligné. L'écran "Réglages du site" propose une action explicite ("Installer le thème dans ce site") qui copie tout le thème d'un coup, purement pour rendre le dépôt autonome — jamais requis pour que le site fonctionne.

L'onglet **Templates** (sidebar) liste tous les gabarits `.html` du thème (gabarits de page et includes partagés `macros/`/`partials/`), avec un éditeur de code ([CodeMirror](https://codemirror.net/), `editor-src/code-editor.js`) et la même preview live que l'éditeur de contenu — `buildPreviewSite()` (`site-builder.js`) accepte indifféremment un brouillon de page (`content/*.md`) ou de gabarit (`templates/*.html`), substitué dans les fichiers du dépôt avant le build Zola. Sauvegarder un gabarit écrit directement son chemin réel dans le dépôt (`templates/...`), sans notion d'override séparée.

### Aperçu en direct

Pendant l'édition (contenu ou gabarit), un rebuild Zola tourne en arrière-plan (débounce ~1,8s après la dernière frappe) sur le dépôt déjà publié + le brouillon en cours, non enregistré (`buildPreviewSite()` dans `site-builder.js`).
Sa sortie (un site multi-pages avec de vrais liens relatifs entre pages/assets) est servie par un **service worker** (`sw.js`) qui intercepte les requêtes sous `/preview/<owner>/<repo>/...` et répond directement depuis une map en mémoire — pas de blob URL ni de `srcdoc` d'iframe, qui casseraient la navigation entre pages.
`config.toml` reçoit un `base_url` différent pour ce build (`/preview/...` plutôt que l'URL réelle du site publié), sinon Zola génère nav/liens/assets en absolu vers un domaine de prod qui n'a pas encore ce contenu.
Rien n'est publié sur le fournisseur tant qu'on ne clique pas sur "Publier" — l'aperçu ne touche que la mémoire du navigateur.

### Inclusion des packages JS

BlockNote (React + ProseMirror + Mantine) est trop imbriqué pour un `<script>`/CDN sans bundler (duplication de singletons ProseMirror).
`zola-builder.js` importe aussi un package npm (`@bjorn3/browser_wasi_shim`), donc même traitement — pareil pour l'éditeur de code de l'onglet Templates (CodeMirror 6, `editor-src/code-editor.js`).
`npm run build` (esbuild) produit trois bundles IIFE : `editor.bundle.js`/`.css`, `zola-builder.bundle.js` et `code-editor.bundle.js`.
Il génère ensuite `index.html` depuis `index.template.html` (le fichier à éditer, `index.html` est gitignore).
Chaque script/style local reçoit un `?v=<hash du commit>`, pour éviter le cache périmé après déploiement.
Le reste de l'app : scripts classiques, sans build.

### Architecture cœur/thèmes/plugins (à venir)

Pour le futur système de plugins/thèmes (feuille de route, item 2), approche **hybride** retenue plutôt qu'un vrai split en deux outils.
Le cœur (`app.js`, `api.js`, éditeur, orchestrateur de build) reste hébergé centralement sur stamperia.io, mis à jour pour tous les sites d'un coup.
**La partie thème de ce pattern est réalisée** (voir "Thème copié dans chaque site" plus haut : chaque dépôt de site a sa propre copie du thème) ; les plugins restent à construire en étendant le même principe.

Pourquoi : updates cœur centralisées (vs vrai split où chaque site fige sa version à la création), repos de site plus légers, une seule surface de sécurité à auditer, réutilise un mécanisme déjà en place.
Migrer plus tard vers un vrai split ("eject" = copier le cœur dans le repo une fois) resterait facile depuis l'hybride ; l'inverse serait coûteux une fois des sites divergés — d'où ce point de départ, à condition de traiter l'API cœur/plugin comme un contrat stable dès le début.

Config du site (thème choisi, réglages plugins) : fichier structuré (JSON/TOML) dans le repo, pas SQLite — reste diff-friendly et cohérent avec l'approche actuelle (front matter + `config.toml` généré), évite les conflits de merge sur binaire que SQLite documente lui-même comme un mauvais fit pour git.

