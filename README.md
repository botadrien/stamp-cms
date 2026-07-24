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
- **Génération du site** via Eleventy (JS, cohérent avec le reste de la stack) +
  pipeline CI (GitHub/Codeberg Actions) qui build et déploie à chaque commit.
- **Modularité dès le départ** : API d'extension stable en vue d'une marketplace de
  plugins et de thèmes, pensée tôt pour éviter un refactor douloureux plus tard.

## Plan d'attaque

Valider brique par brique, en commençant par la plus risquée :

1. **Auth OAuth2+PKCE vers Codeberg** — en cours, voir ci-dessous : login sans serveur,
   liste des dépôts, lecture/écriture d'un fichier Markdown via commit direct.
2. Éditeur riche (BlockNote.js) → conversion en Markdown → écriture dans le dépôt via
   l'API.
3. Pipeline de build automatique (Eleventy + Action) qui build et déploie à chaque
   modification.
4. Ensuite seulement : gestion des médias, support multi-fournisseur Git (GitLab,
   GitHub...) via une couche d'abstraction commune, système de plugins/thèmes.

## Tester en local

Le POC (`index.html`, `config.js`, `pkce.js`, `auth.js`, `api.js`, `app.js`) couvre le
login OAuth+PKCE, la liste des dépôts, et la lecture/écriture d'un fichier Markdown via
commit direct.

1. Crée une OAuth App sur Codeberg (**Settings → Applications**), en **décochant
   "Confidential Client"** (client public, sans secret, requis pour PKCE), avec un
   Redirect URI qui correspond exactement à l'URL de déploiement (ex.
   `http://localhost:8080/` en local).
2. Colle le `clientId` généré dans `config.js`.
3. Sers le dossier avec un serveur statique (obligatoire — `file://` casse `fetch` et
   `crypto.subtle`, et OAuth n'accepte pas les chemins locaux comme Redirect URI) :
   ```bash
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
