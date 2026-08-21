# Stamp CMS

## WordPress, sans le serveur.

Un CMS qui tourne **entièrement dans votre navigateur** — l'édition du contenu et la génération du site.

Gratuit à 100% et toujours :
- aucun serveur à héberger (et payer) comme pour Wordpress
- le site compilé est hébergé sur une plateforme gratuite comme Codeberg Pages.
- plus sécurisé, pas de mise à jour à faire !

**[Démo en ligne](https://botadrien.github.io/stamp-cms/)** — déployée automatiquement sur GitHub Pages à chaque push (voir `.github/workflows/deploy-pages.yml`).
> Note : la connexion sur cette démo suppose que `https://botadrien.github.io/stamp-cms/` soit déclarée comme Redirect URI de l'application OAuth2 correspondante sur codeberg.org (réglage manuel, une seule fois — voir `app/auth/config.js`). **Dépôt renommé** (`cmstatic` → `stamp-cms`) : ce Redirect URI doit être mis à jour à la main sur codeberg.org, sinon la connexion sur la démo casse.

## Fonctionnalités

- **Connexion sans serveur** : OAuth2 + PKCE directement vers Codeberg ou GitLab (pas besoin de bridge), ou jeton d'accès personnel collé à la main pour GitHub (voir "Forges git" ci-dessous pour pourquoi GitHub n'a pas droit au même flow OAuth). Droits d'accès = rôles natifs du fournisseur choisi.
- **Multi-fournisseur** : Codeberg, GitHub et GitLab (gitlab.com uniquement, pas de self-hosted), via une couche d'abstraction commune (`app/providers/api.js`/`app/providers/github-api.js`/`app/providers/gitlab-api.js`/`app/providers/providers.js`) pensée pour qu'ajouter un fournisseur de plus n'exige pas de refonte.
- **Édition riche** : éditeur [Puck](https://puckeditor.com/) (même moteur que la mise en page, voir plus bas) restreint à un bloc de texte riche par page/article, avec panneau de champs pour le titre/la date.
  Contenu stocké en JSON Puck, source de vérité dans le dépôt Git, commit direct à chaque enregistrement — le corps de chaque page/article est injecté au rendu dans le gabarit partagé de son type de route (voir `app/puck/template-merge.js`).
- **Génération du site** avec un renderer maison piloté par [Puck](https://puckeditor.com/) (`app/puck/`), exécuté **dans le navigateur** à chaque publication — voir `docs/plan-puck-ssg.md` pour la conception complète (remplace l'ancien pipeline Zola/Tera).
- **Publication en un clic** : chaque "Publier" compile le site et le publie sur la branche `pages` du dépôt.
- **Contenu structuré** : pages et articles de blog gérés séparément (triés par date pour le blog), écran "Réglages du site" pour le titre du blog.
- **Suppression d'un site** : depuis "Réglages du site", zone dangereuse qui supprime le dépôt entier chez le fournisseur (irréversible, il faut retaper le nom du dépôt pour confirmer).
- **Domaine personnalisé** : depuis "Réglages du site", sous-domaine uniquement pour l'instant (pas de domaine racine/apex) — instructions DNS et vérification en direct (CNAME, TXT le cas échéant) propres au fournisseur connecté, voir "Domaine personnalisé" plus bas pour le détail par fournisseur.
- **Mise en page visuelle** : écran dédié (onglet "Mise en page") qui ouvre l'éditeur [Puck](https://puckeditor.com/) — glisser-déposer des blocs (nav, hero, grille de fonctionnalités, cartes/extraits d'article, footer, etc.), réglage de leurs props, aperçu en direct avec les vraies données du site. Un gabarit par type de route (accueil, page, article, index du blog) ; tant qu'il n'a pas été personnalisé, un site retombe sur le gabarit par défaut (`app/ssg/default-templates.js`), partagé par tous les sites — voir "Éditeur de mise en page Puck" plus bas pour l'architecture.
- **Topic `stamp-cms`** : posé automatiquement sur chaque dépôt créé (topic Forgejo/GitHub/GitLab, public et cherchable). La liste "Tes sites" ne montre que les dépôts portant ce topic (les autres dépôts du compte n'y apparaissent pas), et les sites restent trouvables par recherche de topic côté fournisseur. Les dépôts créés avant l'ajout de cette fonctionnalité n'ont pas le topic et n'apparaissent donc plus dans la liste (pas de migration automatique, cohérent avec le stade très précoce du projet).

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
2. Coller le `clientId` généré dans `app/auth/config.js`
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
généré dans `gitlabClientId` dans `app/auth/config.js`.

### Lancer les tests

Plutôt que de mocker les appels API, les tests e2e (`tests/`) font tourner une vraie instance [Forgejo](https://forgejo.org/) en local via Docker et pilotent un vrai navigateur (Playwright) à travers le flow complet : login OAuth2+PKCE réel (formulaire de connexion, écran de consentement), édition et commit d'un fichier — vérifié ensuite via l'API Forgejo elle-même.

```bash
npm install
npm run e2e        # up (Forgejo + seed) + tests + down, tout en un
```

Ou étape par étape (utile pour déboguer) :

```bash
npm run e2e:up     # démarre Forgejo, crée un user/app OAuth2/dépôt de test (tests/seed.mjs)
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
- Domaine personnalisé : traité pour les sous-domaines (voir "Domaine personnalisé" plus bas) — les domaines racine/apex restent un point ouvert (mécanisme A/AAAA/ALIAS différent par fournisseur, pas encore supporté)
- Médias dans le dépôt Git : ça marche, mais avec des limites de taille (repos volumineux, fichiers individuels plafonnés) — à surveiller si beaucoup de photos/vidéos
- Rester multi-fournisseur à terme sans complexifier le MVP
- Palette de composants Puck encore minimale (hero, grille, CTA, carte/extrait d'article, nav, footer, corps de page) — pas de composant image, par exemple
- Un seul gabarit par type de route (accueil/page/article/index du blog) : pas de gabarit dédié à UNE page en particulier (ex. une page d'accueil visuellement différente d'une autre page standalone), voir "Éditeur de mise en page Puck" plus bas

## Pistes explorées et mises de côté

- **Vrai client git en frontend** ([isomorphic-git](https://isomorphic-git.org/), clone/fetch/push en mémoire plutôt que l'API REST "contents") : code fonctionnel, gardé sur la branche [`explore/isomorphic-git`](https://github.com/botadrien/stamp-cms/tree/explore/isomorphic-git), pas mergé — Codeberg ne renvoie pas de CORS sur ses endpoints git smart-HTTP, et le seul proxy CORS public gratuit s'est révélé trop instable en prod. À revisiter si un proxy auto-hébergé devient acceptable ou si Codeberg ajoute le support CORS sur ces routes.
- **Compiler en CI** (GitHub/Forgejo Actions) plutôt qu'en frontend : plus simple et plus rapide, mais casse la préview live (il faut le SSG dans le navigateur), pas ouvert par défaut sur Codeberg, et ajoute une dépendance externe qu'on veut éviter.
- **[Hugo](https://gohugo.io/) plutôt que Zola** (comparaison obsolète depuis le passage au renderer Puck) : écarté après essai, son pipeline Sass dépendait de `os/exec` pour Dart Sass, incompatible avec un bac à sable WASM.
- **Éditeur Gutenberg de WordPress** plutôt qu'un éditeur par blocs maison : écarté pour la licence GPLv2+ (copyleft fort), le couplage à l'API REST WordPress, et parce que ça n'évitait pas le vrai travail (mapper chaque bloc vers un composant Puck pour le rendu publié).

## Détails techniques

### Forges git

Codeberg répond aux requêtes cross-origin (CORS) sur `/login/oauth/access_token` et sur `/api/v1/*` avec les en-têtes `Access-Control-Allow-Origin`.
Mais Forgejo vanilla ne le fait pas nativement sur ces routes.
`tests/Caddyfile` reproduit ce comportement via un reverse proxy devant Forgejo, pour que l'environnement de test colle au vrai comportement de production.

**Pourquoi GitHub n'a pas le même flow OAuth2 + PKCE que Codeberg** : `api.github.com` répond bien en CORS pour tous les appels REST une fois authentifié, mais `github.com/login/oauth/access_token` (l'échange code → token) ne renvoie aucun en-tête CORS, ce qui bloque l'appel depuis un navigateur.
Pire, même avec le support PKCE ajouté par GitHub en 2025, GitHub exige toujours un `client_secret` pour cet échange — un secret qu'on ne peut pas committer dans une appli 100% front sans le rendre public à toustes.
Plutôt qu'un serveur/proxy dédié rien que pour cet échange (qui aurait été le premier serveur requis par ce projet, contraire à son principe fondateur), GitHub se connecte via un jeton d'accès personnel collé à la main — voir `app/providers/github-api.js`, `app/providers/providers.js` et `app/auth/auth.js:loginWithToken`.

**GitLab** (gitlab.com uniquement, pas de self-hosted) a bien droit au flow OAuth2 + PKCE en un clic comme Codeberg : `gitlab.com/oauth/token` renvoie `access-control-allow-origin: *` (vérifié en direct, preflight et réponse réelle), pas de blocage CORS comme sur GitHub.
En revanche GitLab Pages n'a pas d'équivalent du webhook Codeberg ou de l'API Pages GitHub : son API Pages (`GET`/`PATCH`/`DELETE /projects/:id/pages`) ne gère que les réglages (domaine, HTTPS) et la dépublication, aucun endpoint d'upload direct — **un pipeline CI est toujours requis pour publier**, contrairement aux deux autres fournisseurs.
`GitLabApi.enablePublishing()` (`app/providers/gitlab-api.js`) committe donc une fois un `.gitlab-ci.yml` minimal dont le job ne compile rien : il republie tel quel (via `rsync`) le contenu déjà buildé côté client et présent sur la branche `pages`, pour rester cohérent avec le principe du projet (compilation toujours dans le navigateur, jamais côté serveur/CI).

La couche d'abstraction (`ForgejoApi` dans `app/providers/api.js`, `GitHubApi` dans `app/providers/github-api.js`, `GitLabApi` dans `app/providers/gitlab-api.js`, choix du bon client via `app/providers/providers.js`) absorbe les différences d'API entre les trois forges : création de branche (un seul appel côté Forgejo/GitLab, lecture de ref + création de ref côté GitHub), activation de la publication (webhook côté Codeberg Pages, appel dédié à l'API Pages côté GitHub, `.gitlab-ci.yml` committé côté GitLab), `PUT` systématique de l'API contents de GitHub là où Forgejo/GitLab distinguent `POST`/`PUT` selon création ou mise à jour, et la détection de conflit d'édition (422 chez Forgejo, 409 chez GitHub, 400 chez GitLab — voir `isConflict()` sur chaque client).
GitLab identifie aussi ses projets par un chemin `owner/repo` URL-encodé en un seul segment d'URL plutôt que deux segments séparés, et pagine son endpoint d'arbre de fichiers (`listTree()`) là où Forgejo/GitHub renvoient tout en un seul appel — détails absorbés par `app/providers/gitlab-api.js`, voir ses commentaires de tête de fichier.

### Génération du site dans le navigateur

Le site est rendu par un renderer maison piloté par [Puck](https://puckeditor.com/)
(`app/puck/`, voir `docs/plan-puck-ssg.md` pour la conception complète), en JS pur —
pas de binaire WASM, pas de shim WASI. `app/ssg/content-loader.js` parse
`content/*.puck.json` (chaque page/article est un objet `Data` Puck : `root.props` pour
le titre/la date, `content[]` pour le corps — voir "Édition de contenu" plus bas),
`app/ssg/context.js` construit le contexte de données, `app/puck/resolver.js` résout les
bindings des gabarits Puck, et `app/ssg/renderer.jsx` orchestre le tout : parcourt les
routes du site, fusionne le corps propre à chaque page/article dans le gabarit partagé de
son type de route (`app/puck/template-merge.js`), rend chaque page via `<Render>` de Puck +
`renderToStaticMarkup`, génère `rss.xml`/`sitemap.xml`.
Bundlé pour le navigateur via `editor-src/ssg-builder.js` -> `ssg-builder.bundle.js`
(global `SsgBuilder`), même principe que `puck-content-editor.jsx`/`PuckContentEditor`.

### Édition de contenu

Chaque page/article est édité avec Puck (`editor-src/puck-content-editor.jsx`, global
`PuckContentEditor`) — une Config Puck restreinte à une poignée de blocs de contenu
(`app/puck/components/`) : `RichText` (texte formaté, champ natif `type: "richtext"` de
Puck/Tiptap embarqué), `Heading` (titre H2/H3/H4 autonome), `Callout` (encart), `Quote`
(citation), `Divider` (séparateur), `CodeBlock` (bloc de code), `Accordion` (accordéon/
volet repliable) et `Space` (espaceur vertical) — inspirés des blocs Notion/Gutenberg/
gouvfr-docs, volontairement sans aucun qui nécessite un upload (pas d'image, pas de
galerie). Restreinte volontairement : impossible d'y glisser un
Nav/Hero/Footer, le contenu d'une page/d'un article reste un corps de texte — nav/hero/
footer restent définis une fois par type de route (voir "Éditeur de mise en page Puck"
plus bas). Titre (et date pour un article) s'éditent via le panneau de champs racine de
Puck (`root.fields`), pas un champ séparé hors du canvas.

Ces blocs sont aussi enregistrés dans la palette complète (`app/puck/registry.jsx`) : le
renderer de publication (`app/ssg/renderer.jsx`) s'en sert pour rendre le contenu fusionné
dans `ContentSlot`, donc un type de bloc utilisé en contenu doit toujours y figurer aussi,
sous peine de faire planter le rendu de toute page en contenant un.

Le champ richtext (`RichText`, `Accordion`) s'édite depuis le panneau de champs (sidebar
droite), pas par clic direct dans le canvas : le canvas n'affiche qu'un aperçu en lecture
seule du corps (limite du mode `iframe: { enabled: false }`, nécessaire pour que le
contexte React `SsgContext` traverse jusqu'aux composants bindables — voir "Éditeur de
mise en page Puck").

Au clic sur "Publier", le contenu (`JSON.stringify` de l'objet `Data` de l'article/la
page) est commité sur `main` à `content/<slug>.puck.json` /
`content/blog/<slug>.puck.json`, puis le site entier est régénéré et publié sur `pages`
— même flux qu'avant (voir "Publication en un clic" plus haut), format de fichier
seulement.

Un site retombe sur le gabarit par défaut (`app/ssg/default-templates.js`) tant qu'il
n'a pas été personnalisé via l'éditeur de mise en page (voir section dédiée ci-dessous).

Lors de la publication, chaque fichier produit (HTML, `rss.xml`, `sitemap.xml`) est
publié sur la branche `pages`.

### Éditeur de mise en page Puck

Écran "Mise en page" (sidebar) : liste les 4 types de gabarit (accueil, page standalone,
article de blog, index du blog — mêmes clés que `app/ssg/default-templates.js`), ouvre
l'éditeur visuel `<Puck>` (`@puckeditor/core`) en plein écran sur celui choisi
(`openLayoutEditor()` dans `app/app.js`).

**Stockage** : un fichier `templates/<nom>.puck.json` par gabarit personnalisé, sur la
branche `main` (`LAYOUT_TEMPLATE_FILES` dans `app/site/site-builder.js`) — le JSON brut produit
par Puck (`{ root, content }`, voir `app/ssg/renderer.jsx`). Absent -> le gabarit par
défaut correspondant s'applique, fusion fichier par fichier comme l'ancien thème Zola
avant lui (un site n'ayant personnalisé qu'UN SEUL gabarit garde les trois autres par
défaut). Le bouton "Publish" natif de Puck écrit ce fichier puis republie tout le site
(`saveLayoutTemplate()` dans `app/site/site-builder.js`) — le canvas de Puck EST déjà l'aperçu en
direct des changements, pas d'étape à part.

**Aperçu avec les vraies données** : le canvas affiche les composants avec de vrais
bindings résolus (nav du site, dernier article, etc.), pas des données inventées —
`buildLayoutEditorData()` (`app/site/site-builder.js`) construit un Context de prévisualisation
(`SsgBuilder.buildContext()`/`loadCollections()`) à partir du contenu réel du site, avec
la première page/le premier article existant comme représentant·e pour les gabarits
"page"/"article".

**Contrainte cross-bundle React** : `editor-src/puck-layout-editor.jsx` (bundlé à part,
`puck-layout-editor.bundle.js`, global `PuckLayoutEditor`) réimporte la palette de
composants (`app/puck/registry.jsx`) au lieu de réutiliser `SsgBuilder`'s — chaque bundle
esbuild IIFE embarque sa propre copie de React (voir "Inclusion des packages JS"
ci-dessous), et les fonctions `render()` de la palette (qui appellent `useContext`, voir
`app/puck/ssg-context.js`) doivent tourner sous LE MÊME React que celui qui pilote
`<Puck>` — sinon erreur "Invalid hook call", ou pire, un `Context.Provider` dont la
valeur ne traverse jamais jusqu'au composant. Seules des données pures (le `Context`
lui-même) traversent la frontière entre bundles sans risque. Pour la même raison, le
canvas d'édition est rendu avec `iframe: { enabled: false }` (rendu inline dans le
document plutôt que dans un iframe isolé, qui serait un realm JS séparé où le
`SsgContext.Provider` posé autour de `<Puck>` ne serait jamais vu).

### Lecture du dépôt : archive complète + cache local

`content/` (pages, articles) est lu en un seul aller-retour réseau par fournisseur
plutôt qu'un appel par fichier :
- **Forgejo/Codeberg et GitLab** : un appel à l'endpoint d'archive (`/archive/{ref}.tar.gz`, `/repository/archive.tar.gz`), CORS ouvert vérifié en direct sur les deux (`access-control-allow-origin: *`), décompressé et parsé côté navigateur (`DecompressionStream` natif + petit parseur tar maison dans `app/site/tar-utils.js`, pas de dépendance zip).
- **GitHub** : l'archive/tarball est bloquée pour un usage navigateur (`/tarball/{ref}` redirige vers `codeload.github.com`, qui ne renvoie `access-control-allow-origin` que pour `render.githubusercontent.com`, vérifié en direct). À la place : un `listTree` (déjà un seul appel) puis **une seule** requête GraphQL groupée (`api.github.com/graphql`, CORS ouvert vérifié) avec un alias par fichier.
- Piège rencontré (et corrigé) sur l'endpoint archive Forgejo : il répond `Cache-Control: private, max-age=300` sur une URL qui ne varie pas avec le commit (`.../archive/main.tar.gz`) — sans `cache: "no-store"` explicite sur le `fetch`, le cache HTTP du navigateur pouvait reservir une archive périmée après deux publications rapprochées (repéré via la suite e2e, page fraîchement publiée absente de la liste juste après).

Le résultat (`{ chemin: Uint8Array }` pour tout le dépôt) est mis en cache localement en **IndexedDB** (`app/site/repo-cache.js`) plutôt que retéléchargé à chaque écran : un sha HEAD de branche (appel léger, un par fournisseur) est comparé au sha mis en cache avant de décider de retélécharger ou non — `localStorage` a été écarté (quota ~5-10 Mo/origine, API synchrone bloquante, chaînes de caractères seulement).

### Domaine personnalisé

Réglage stocké dans un nouveau fichier **`site.toml`** à la racine de chaque dépôt de site (branche `main`) — première brique du futur "fichier structuré de config du site" évoqué dans "Architecture cœur/thèmes/plugins" plus bas. Jamais lu par le renderer (ni `content/`, ni le reste du dépôt), donc jamais publié sur la branche `pages` : reste un fichier source, comme `content/*.puck.json`. Lu/écrit via `getCustomDomain()`/`setCustomDomain()` (`app/site/site-builder.js`), et propagé dans le `baseUrl` passé au renderer à chaque publication (`rebuildAndPublishSite()`).

**Sous-domaines uniquement** (ex. `www.exemple.com`) — pas de domaine racine/apex, pour éviter la variété de mécanismes A/AAAA/ALIAS/ANAME selon le registrar. Chaque fournisseur a un mécanisme d'activation différent (vérifié contre leurs docs officielles) :
- **GitHub Pages** : un simple champ `cname` sur l'API Pages (`PUT /repos/{owner}/{repo}/pages`) — pas de fichier `CNAME` à committer.
- **Codeberg Pages** : purement basé sur le DNS (CNAME + un enregistrement TXT d'autorisation à `_git-pages-repository.<domaine>`) — mais le webhook de publication existant (voir `ForgejoApi.enablePublishing`) doit être repointé vers le nouveau domaine, sans quoi la publication cible encore l'ancienne URL. Ce repointage casse la publication tant que le DNS n'a pas propagé — l'écran Réglages en avertit explicitement.
- **GitLab Pages** : API dédiée (`/projects/:id/pages/domains`), avec une étape de vérification DNS (enregistrement TXT `gitlab-pages-verification-code=...`) obligatoire sur gitlab.com avant que le domaine ne serve réellement le site (`auto_ssl_enabled` pour un certificat Let's Encrypt automatique).

**Vérification DNS en direct** (`app/site/dns-check.js`) : un vrai lookup DNS n'est pas possible depuis un navigateur, donc interrogation de l'API DNS-over-HTTPS de Cloudflare (`cloudflare-dns.com/dns-query`, CORS ouvert vérifié en direct) pour savoir si le CNAME pointe déjà vers la bonne cible — utilisé pour le bouton "Vérifier le DNS" et comme garde-fou avant de repointer le webhook Codeberg (avertissement si le DNS ne semble pas encore configuré, plutôt que de casser la publication à l'aveugle).

### Inclusion des packages JS

Puck (React + `@puckeditor/core`) est trop imbriqué pour un `<script>`/CDN sans bundler (duplication de singletons React).
`app/ssg/renderer.jsx`, l'éditeur de mise en page (`editor-src/puck-layout-editor.jsx`, React + `<Puck>`) et l'éditeur de contenu (`editor-src/puck-content-editor.jsx`, idem, Config restreinte) ont tous besoin du même traitement.
`npm run build` (esbuild) produit trois bundles IIFE dans `app/` : `app/ssg-builder.bundle.js`, `app/puck-layout-editor.bundle.js`/`.css` et `app/puck-content-editor.bundle.js`/`.css`. Les trois bundles embarquent chacun leur propre copie de React (aucun module partagé entre bundles esbuild IIFE séparés) — voir "Éditeur de mise en page Puck" plus haut pour pourquoi ça impose de réimporter la palette de composants dans `puck-layout-editor.bundle.js`/`puck-content-editor.bundle.js` plutôt que de la réutiliser depuis `ssg-builder.bundle.js`.
Il génère ensuite `app/index.html` depuis `app/index.template.html` (le fichier à éditer, `app/index.html` est gitignore) — `app/` est servi comme racine de l'app admin, en local (`scripts/local-server.py`) comme en déploiement (`.github/workflows/deploy-pages.yml` copie le contenu de `app/` à la racine du site publié).
Chaque script/style local reçoit un `?v=<hash du commit>`, pour éviter le cache périmé après déploiement.
Le reste de l'app : scripts classiques, sans build.

### Architecture cœur/thèmes/plugins (à venir)

Pour le futur système de plugins/thèmes (feuille de route, item 2), approche **hybride** retenue plutôt qu'un vrai split en deux outils.
Le cœur (`app/app.js`, `app/providers/api.js`, éditeur, renderer) reste hébergé centralement sur stamperia.io, mis à jour pour tous les sites d'un coup.
La partie thème de ce pattern reste à construire côté Puck : le mécanisme précédent ("chaque dépôt de site a sa propre copie du thème") a été retiré avec Zola — tous les sites partagent aujourd'hui le même jeu de gabarits par défaut (`app/ssg/default-templates.js`, voir "Génération du site dans le navigateur" plus haut), sans notion de thème/plugin par site pour l'instant.

Pourquoi l'approche hybride : updates cœur centralisées (vs vrai split où chaque site fige sa version à la création), repos de site plus légers, une seule surface de sécurité à auditer.
Migrer plus tard vers un vrai split ("eject" = copier le cœur dans le repo une fois) resterait facile depuis l'hybride ; l'inverse serait coûteux une fois des sites divergés — d'où ce point de départ, à condition de traiter l'API cœur/plugin comme un contrat stable dès le début.

Config du site (thème choisi, réglages plugins) : fichier structuré (JSON/TOML) dans le repo, pas SQLite — reste diff-friendly (front matter + gabarits Puck en JSON), évite les conflits de merge sur binaire que SQLite documente lui-même comme un mauvais fit pour git.

