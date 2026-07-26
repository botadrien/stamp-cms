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

- **Connexion sans serveur** : OAuth2 + PKCE directement vers Codeberg (pas besoin de bridge). Droits d'accès = rôles natifs de Codeberg.
- **Édition riche** : éditeur visuel similaire à Notion ([BlockNote.js](https://www.blocknote.js.org/) sur [ProseMirror](https://prosemirror.net/))
  Contenu stocké en Markdown, source de vérité dans le dépôt Git, commit direct à chaque enregistrement.
- **Génération du site** avec [Zola](https://www.getzola.org/), compilé en WebAssembly et exécuté **dans le navigateur** à chaque publication.
- **Aperçu en direct** : pendant l'édition, un volet à côté de l'éditeur montre le site réellement généré par Zola (nav, thème, mise en page) à partir du brouillon en cours — rien n'est publié tant qu'on n'a pas cliqué sur "Publier".
- **Publication en un clic** : chaque "Publier" compile le site et le publie sur la branche `pages` du dépôt.
- **Contenu structuré** : pages et articles de blog gérés séparément (triés par date pour le blog), écran "Réglages du site" pour le titre du blog.
- **Thème** : un thème vendoré, volks-typo, appliqué à chaque site créé (choix de thème prévu plus tard, voir "Roadmap").

## Feuille de route

1. **Gestion des médias** (images, etc.) dans le dépôt Git.
2. **Support multi-fournisseur Git** (GitLab, GitHub...) via une couche d'abstraction commune.
3. **Système de plugins/thèmes**, avec une API d'extension stable pensée dès maintenant pour éviter un refactor douloureux plus tard, en vue d'une marketplace de plugins et de thèmes.

## État de l'art / Inspirations

- **[Decap CMS](https://decapcms.org/) / [Tina CMS](https://tina.io/)** — CMS Git, mais orientés développeurs
- **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)** — successeur spirituel de Decap, UI plus moderne, config toujours technique
- **[Publii](https://getpublii.com/)** — facile à utiliser sans être développeur·euse. L'app desktop à installer rend la collaboration compliquée.
- **[GitCMS](https://github.com/BestPlayerMMIII/GitCMS)** (open source, éditeur TipTap) et **[gitcms.dev](https://gitcms.dev/)** (service commercial, mais passe par une GitHub App donc nécessite un backend — hors scope ici)

## Développement / Contribuer

### Lancer en local

1. Créer une OAuth App sur Codeberg (**Settings → Applications**), en **décochant "Confidential Client"** , avec comme Redirect URI `http://localhost:8080`
2. Coller le `clientId` généré dans `config.js`
3. `npm install`
4. `make run`
5. Ouvrir `http://localhost:8080/`

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


## Points à trancher / vigilance

- Conflits d'édition simultanée (verrouillage simple vs temps réel type [Yjs](https://yjs.dev/))
- Sécurité du token OAuth stocké côté navigateur
- Quotas de l'API du fournisseur Git
- Domaine personnalisé
- Médias dans le dépôt Git : ça marche, mais avec des limites de taille (repos volumineux, fichiers individuels plafonnés) — à surveiller si beaucoup de photos/vidéos
- Rester multi-fournisseur à terme sans complexifier le MVP

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

## Détails techniques

### Forges git

Codeberg répond aux requêtes cross-origin (CORS) sur `/login/oauth/access_token` et sur `/api/v1/*` avec les en-têtes `Access-Control-Allow-Origin`.
Mais Forgejo vanilla ne le fait pas nativement sur ces routes.
`e2e/Caddyfile` reproduit ce comportement via un reverse proxy devant Forgejo, pour que l'environnement de test colle au vrai comportement de production.

### Génération du site dans le navigateur

On a compilé [Zola](https://www.getzola.org/) en WASM grace au travail de Dylan Staley cf [ce billet](https://dstaley.com/posts/running-zola-on-wasm/).
C'est possible car on fait en sorte que Zola ne dépend d'aucun process externe : `rayon` (parallélisme) désactivé, `canonicalize()` contourné (non supporté par WASI), et Sass compilé par `grass` (Rust pur) plutôt que par LibSass/Dart Sass.
Le binaire compilé `vendor/zola.wasm` fait ~15 Mo
On le commit tel quel car sa compilation demande un toolchain Rust + wasi-sdk trop lourd pour `npm run build` (cf `scripts/build-zola-wasm.sh`)
Il tourne dans le navigateur via [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim)
On l'utilise avec un système de fichiers entièrement en mémoire (voir `editor-src/zola-builder.js`).

Lors de la publication du site, on l'éxecute navigateur puis chaque fichier compilé (HTML, CSS images) produit est publié sur la branche `pages`.

Chaque site est buildé avec le même thème Zola vendoré, **volks-typo** (`themes/volks-typo/`, récupéré via `scripts/fetch-theme-volks-typo.sh` — voir `site-builder.js` pour le point d'accroche prévu pour un choix de thème plus tard).

### Aperçu en direct

Pendant l'édition, un rebuild Zola tourne en arrière-plan (débounce ~1,8s après la dernière frappe) sur le contenu déjà publié + le brouillon en cours, non enregistré (`buildPreviewSite()` dans `site-builder.js`).
Sa sortie (un site multi-pages avec de vrais liens relatifs entre pages/assets) est servie par un **service worker** (`sw.js`) qui intercepte les requêtes sous `/preview/<owner>/<repo>/...` et répond directement depuis une map en mémoire — pas de blob URL ni de `srcdoc` d'iframe, qui casseraient la navigation entre pages.
`config.toml` reçoit un `base_url` différent pour ce build (`/preview/...` plutôt que l'URL réelle du site publié), sinon Zola génère nav/liens/assets en absolu vers un domaine de prod qui n'a pas encore ce contenu.
Rien n'est publié sur Codeberg tant qu'on ne clique pas sur "Publier" — l'aperçu ne touche que la mémoire du navigateur.

### Inclusion des packages JS

BlockNote (React + ProseMirror + Mantine) est trop imbriqué pour un `<script>`/CDN sans bundler (duplication de singletons ProseMirror).
`zola-builder.js` importe aussi un package npm (`@bjorn3/browser_wasi_shim`), donc même traitement.
`npm run build` (esbuild) produit deux bundles IIFE : `editor.bundle.js`/`.css` et `zola-builder.bundle.js`.
Il génère ensuite `index.html` depuis `index.template.html` (le fichier à éditer, `index.html` est gitignore).
Chaque script/style local reçoit un `?v=<hash du commit>`, pour éviter le cache périmé après déploiement.
Le reste de l'app : scripts classiques, sans build.

