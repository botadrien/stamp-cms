# Plan : remplacer Zola/Tera par un SSG maison piloté par Puck

## Contexte

Aujourd'hui, l'édition de contenu (BlockNote → Markdown) est riche, mais la mise en
page reste figée : les gabarits Zola/Tera (`themes/volks-typo/templates/*.html`) sont
du texte édité dans l'onglet Templates, pas quelque chose qu'on peut réarranger par
glisser-déposer. L'objectif est d'ajouter de l'édition visuelle de mise en page
(fonds, déplacement de blocs) pour les gabarits, les pages d'index et les menus — pas
seulement pour le contenu d'une page isolée.

Trois architectures ont été comparées, par ordre d'éloignement croissant de Zola :

1. **Puck ne touche qu'au contenu** : son arbre JSON est pré-rendu côté client en une
   chaîne HTML statique, injectée dans un gabarit Tera inchangé et écrit à la main.
   Le moins coûteux, mais Puck ne fait alors que générer du contenu de page — il ne
   touche jamais à la structure/mise en page, donc ne tient pas vraiment la promesse
   de "déplacer des blocs au niveau du gabarit".
2. **Puck écrit du vrai Tera via un compilateur `toTera()`** : chaque composant Puck
   a une seconde fonction de rendu qui émet du Tera dans un bloc balisé du fichier
   `.html` ; rouvrir ce gabarit veut dire re-parser ce bloc en arbre Puck. Ça marche,
   mais c'est un compilateur bidirectionnel entre deux représentations (arbre de
   composants ⇄ dialecte Tera fait maison) — du vrai poids d'ingénierie, et toute
   modification manuelle dans le bloc balisé risque de casser l'aller-retour.
3. **On abandonne Zola** : un petit SSG maison dont le format natif de gabarit est
   directement le JSON de Puck. **✅ direction retenue.**

**Pourquoi l'option 3** : le coût central de l'option 2 est le pont entre deux
représentations différentes (arbre de composants vs texte Tera). En possédant le
renderer, ce pont disparaît : le "gabarit" est directement l'arbre JSON de Puck,
sauvegardé et versionné tel quel dans git, et "compiler" une page consiste à donner
de vraies données à cet arbre puis appeler le `Render` de Puck lui-même. Pas de
second langage, pas de couche `toTera()`, pas de parseur pour relire les gabarits
dans l'éditeur.

Ça s'aligne sur le fonctionnement réel de Builder.io en production : le contenu est
du JSON passé à un composant de rendu, avec un objet de contexte/données séparé qui
fournit les valeurs "bindables" et un registre qui associe des noms de composants à
de vraies implémentations — pas une couche de templating textuelle entre les deux.

## Vocabulaire

Pas de correspondance directe en un mot avec Tera, donc à définir clairement une fois
ici plutôt qu'à chaque relecture :

- **Contexte** : l'objet JS qui contient les données disponibles au moment d'afficher
  une page — l'équivalent des variables globales que Tera fournit (`page`, `section`,
  `config`), mais en objet JS plutôt qu'en variables de gabarit.
- **Binding** : un champ d'un composant Puck qui, au lieu d'une valeur tapée en dur,
  contient un descripteur du type `{ $bind: "page.title" }`. L'équivalent visuel du
  `{{ page.title }}` de Tera, choisi dans l'interface plutôt que tapé en texte.
- **Resolver** : la fonction qu'on écrit nous-mêmes pour que les bindings
  fonctionnent réellement — elle parcourt l'arbre de composants juste avant
  l'affichage et remplace chaque `{ $bind: ... }` par la vraie valeur trouvée dans le
  contexte. C'est le travail que le moteur Tera fait tout seul aujourd'hui.
- **Repeater** : un composant Puck dont le rôle est "répète ce qu'il y a dedans, une
  fois par élément d'une collection" — l'équivalent visuel du
  `{% for post in section.pages %}` de Tera.
- **Renderer** : le moteur global qui prend l'arbre Puck d'une page + le contexte,
  applique le resolver partout, et produit le HTML final — l'équivalent de la
  commande `zola build` d'aujourd'hui, sauf que l'entrée n'est plus des fichiers
  `.html` en Tera mais des fichiers `.puck.json`.

## Pièces de conception

### Gabarits comme données, pas comme texte

Les mises en page (coquille du site, gabarits de page, gabarits de section) sont
stockées en fichiers `.puck.json` dans le dépôt, versionnées par git exactement comme
le contenu l'est déjà.

### Contexte et bindings

Forme du contexte, reconstruite à chaque build/preview (comme `buildPreviewSite()`
aujourd'hui) :

```js
{
  site: { title, baseUrl, nav: [...], ...siteTomlFields },
  page?: { title, slug, url, date, excerpt, body, frontMatter },
  section?: { title, slug, url },
  collections: { pages: [...], blog: [...] }
}
```

`collections` reprend exactement le split déjà fait dans `app.js`
(`listContentPages`/`renderPageGroup` : pages standalone vs `content/blog/*.md`) —
pas de nouveau découpage à inventer.

Deux formes de binding, plutôt qu'un seul path-string façon mini-DSL (qui nous
ramènerait vers "réinventer Tera") :

- `{ $bind: "site.title" }` → simple lookup dans le contexte.
- `{ $bind: "collection", from: "blog", sortBy: "date", order: "desc", limit: 5 }` →
  requête déclarative sur une collection, résolue en tableau d'items.

Ça reste du JSON structuré, facile à valider et à générer depuis un champ Puck (des
`<select>` pour tri/limite plutôt qu'un texte libre à parser).

**À trancher avant/au fil du prototype :**

- Un `filter` (ex. par catégorie, pour un menu qui ne liste qu'un sous-ensemble)
  est-il nécessaire dès le prototype, ou différé à plus tard ?
- Les valeurs calculées (ex. "lien nav actif", qui dépend de la page courante) :
  champ calculé dans `page`/`site` au moment de construire le contexte, ou différé ?

### Resolver

Une seule fonction pure, utilisée à l'identique en preview et en publication (pas
deux chemins qui peuvent diverger) :

```js
resolveProps(props, context) -> props'
```

Parcourt récursivement objets/tableaux, remplace tout noeud `{ $bind: ... }` par sa
valeur résolue, laisse les littéraux intacts.

### Repeater

Prop `source` = descripteur de collection ci-dessus. Pour chaque item résolu, le slot
Puck est rendu avec `{ ...context, item }` — les composants enfants du slot bindent
sur `item.title`, `item.excerpt`, etc. C'est ce qui rend composables (plutôt
qu'opaques et figées) les pages d'index, les listes d'articles et les menus dans le
canvas.

### Contenu inchangé

Le contenu du blog reste en Markdown : BlockNote → Markdown → front matter + corps,
parsé avec une lib Markdown JS (ex. `remark`) au moment du rendu — pas de WASM dans
ce nouveau pipeline.

### Style/thème

Puck gère déjà couleurs/espacements comme des props de composant — ceux-ci peuvent
émettre du style inline ou des custom properties CSS directement, ce qui évite de
reconstruire un pipeline de préprocessing CSS juste pour ça.

### Aperçu en direct

Le renderer entier est du JS/React déjà expédié pour Puck/BlockNote — plus de binaire
WASM de 15 Mo, plus de shim WASI, plus de contournements `rayon`/`canonicalize`/
`grass`. L'aperçu en direct devrait donc devenir plus simple qu'aujourd'hui, pas plus
compliqué.

## Grandes tâches

1. **Modèle contexte/données** — définir la forme exacte de l'objet `page`/`section`/
   `config` que lit le resolver ; concevoir comment les collections (tous les
   articles d'une section, triés par date, etc.) sont interrogées depuis le contenu
   du dépôt en mémoire.
2. **Resolver + type de champ "binding"** — nouveau type de champ Puck pour choisir
   un chemin de données plutôt que taper une valeur littérale ; fonction de
   résolution qui parcourt un arbre de props et substitue les valeurs bindées au
   rendu.
3. **Composant Repeater** — composant bindé à une collection avec contexte scoped par
   item ; nécessaire pour pages d'index, listes d'articles et menus.
4. **Chargeur Markdown/front matter** — parsing JS (front matter + corps) remplaçant
   le pipeline de contenu de Zola ; alimente le contexte de page.
5. **Renderer / orchestrateur de build** — parcourt les routes du site, résout le
   gabarit `.puck.json` + contenu de chaque page, rend via le `Render` de Puck +
   `renderToStaticMarkup`, écrit le résultat dans le système de fichiers en mémoire
   déjà utilisé pour la publication.
6. **Générateur de flux RSS** — petite fonction faite main produisant du XML à partir
   des mêmes données de contexte/collection que gérait `generate_feed = true` côté
   Zola.
7. **Génération du sitemap** — pareil, fait main plutôt qu'un flag de config Zola.
8. **Palette de composants** — construire la vraie bibliothèque de composants Puck
   (hero, grille de fonctionnalités, CTA, carte d'article, nav, footer, etc.) que les
   auteur·ices manipuleront réellement.
9. **Props de style/thème** — sélecteurs de couleur, espacement, typographie reliés à
   du style inline ou des custom properties CSS, en remplacement de ce que faisait
   Sass/les variables de thème.
10. **Point de contrôle prototype** — construire de bout en bout le cas "page d'index
    avec Repeater" en premier, puisque c'est l'endroit où bindings, collections et
    l'API de slot de Puck doivent tous coopérer à la fois ; valider avant d'aller
    plus loin.

## Alternatives écartées (et quand les reconsidérer)

- **Garder Zola, option 1** (Puck pré-rend du contenu, gabarits Tera fixes et
  écrits à la main) reste le chemin le moins coûteux si le glisser-déposer n'est
  utile que pour du contenu ponctuel type page d'atterrissage, pas pour les gabarits
  eux-mêmes — ça garde gratuitement le sitemap/les taxonomies/l'i18n/le pipeline
  d'images de Zola.
- **GrapesJS**, limité à une palette de composants fixe avec son Style Manager
  intégré, est une façon plus légère d'obtenir "changer les couleurs, réordonner un
  jeu de sections fixe" sans avoir besoin d'un canvas de niveau page-builder ni d'un
  compilateur de gabarit bidirectionnel, et ça reste agnostique du framework plutôt
  que d'ajouter un second arbre React.
- **Option 2** (Puck écrit du vrai Tera via un compilateur `toTera()`, re-parsé à la
  réouverture) ne vaut le coup que s'il y a une exigence forte de garder des fichiers
  Tera lisibles/éditables à la main comme source de vérité en plus de l'édition
  visuelle — sinon c'est strictement plus d'ingénierie que l'option 3 pour un
  résultat moins bon.

## Points ouverts / vigilance

- **RSS/sitemap/i18n/taxonomies** : ce que Zola fournissait gratuitement doit être
  refait à la main — pas bloquant, mais à chiffrer sérieusement, surtout l'i18n si
  volks-typo ou des sites existants en dépendent.
- **Thème par défaut** : pas de contrainte de fidélité à volks-typo — le thème par
  défaut des sites rendus est ouvert à un nouveau design. Le point de contrôle
  prototype (page d'index + Repeater) a quand même besoin d'au moins une petite
  maquette de composants Puck pour être représentatif, mais ça peut être un design
  neuf plutôt qu'une reconstitution de volks-typo.

## Parallélisation (plusieurs agents, plusieurs worktrees)

Aucun code Puck n'existe encore dans le repo (pas de dépendance `@measured/puck`
dans `package.json`, rien sous `editor-src/`) : la toute première étape n'est donc
**pas** parallélisable — il faut fixer un contrat d'interfaces commun avant de
lâcher plusieurs agents sur plusieurs worktrees, sinon chacun invente sa propre
forme de contexte/resolver et la fusion devient ingérable.

### Phase 0 — contrat, séquentiel, avant tout (une seule track)

Fixer, sans forcément tout implémenter :

- la forme exacte de l'objet `context` (`site`/`page`/`section`/`collections`),
- la signature de `resolveProps(props, context)`,
- la forme du descripteur `{ $bind: ... }` (lookup simple vs requête sur collection),
- l'emplacement des fichiers (ex. `ssg-src/context.js`, `ssg-src/resolver.js`,
  `ssg-src/components/`, `ssg-src/feeds/`),
- l'ajout de `@measured/puck` (ou équivalent) au `package.json`.

### Phase 1 — tracks parallèles

| Track | Tâches couvertes | Dépend de (contrat seulement) | Fichiers possédés |
|---|---|---|---|
| **A — Données** | 1 (contexte) + 4 (loader Markdown) | rien | `ssg-src/context.js`, `ssg-src/content-loader.js` |
| **B — Bindings** | 2 (resolver + champ binding) | signature du resolver | `ssg-src/resolver.js`, `ssg-src/fields/binding-field.jsx` |
| **C — Repeater** | 3 (composant Repeater) | contrat de B (peut stubber le resolver) + contrat de collection de A | `ssg-src/components/repeater.jsx` |
| **D — Palette** | 8 (composants) + 9 (props de style) | contrat du champ binding de B (peut stubber en attendant) | `ssg-src/components/*.jsx` (un fichier par composant) |
| **E — Flux** | 6 (RSS) + 7 (sitemap) | contrat de collection de A | `ssg-src/feeds/rss.js`, `ssg-src/feeds/sitemap.js` |

Règle anti-conflit de merge : chaque composant/module vit dans son propre fichier ;
aucune track ne touche un fichier "registre" partagé (ex. l'index qui liste tous les
composants) — cet agrégateur est écrit une seule fois, en phase 2, par l'intégration.

### Phase 2 — intégration, séquentiel, après fusion des tracks

Tâche 5 (renderer/orchestrateur) puis tâche 10 (point de contrôle prototype) : ces
deux étapes ont besoin que les tracks A à D existent réellement, pas juste en
contrat — elles ne peuvent démarrer qu'après la fusion des worktrees parallèles.

#### Brief — Track A (Données)

Construire le modèle de contexte et le chargeur Markdown/front matter.
Contexte du projet : `content/*.md` (pages) et `content/blog/*.md` (articles) sont
déjà lus et groupés côté app existante (`app.js` : `listContentPages`/
`renderPageGroup`) — reprendre exactement ce même découpage plutôt qu'en inventer un
nouveau. Livrable : `ssg-src/context.js` (construit l'objet `{ site, page?, section?,
collections }`) et `ssg-src/content-loader.js` (parse front matter + corps en JS,
ex. via `remark`/`gray-matter`, sans dépendance WASM). Ne pas toucher aux fichiers
d'autres tracks.

#### Brief — Track B (Bindings)

Construire le resolver et le champ Puck pour choisir un binding.
`resolveProps(props, context)` parcourt récursivement un arbre de props Puck,
remplace tout noeud `{ $bind: "chemin.vers.valeur" }` par sa valeur trouvée dans
`context` (lookup simple), et tout noeud `{ $bind: "collection", from, sortBy,
order, limit }` par le tableau résultant de la requête sur `context.collections`.
Les littéraux (chaînes, nombres, tableaux sans `$bind`) traversent inchangés. Fournir
aussi un type de champ Puck (`ssg-src/fields/binding-field.jsx`) qui affiche un
sélecteur de chemin plutôt qu'un texte libre. Cette track n'a besoin que de la forme
du contexte en contrat (voir Phase 0), pas de son implémentation réelle — tester
avec un objet de contexte factice.

#### Brief — Track C (Repeater)

Construire le composant Puck "Repeater" : une prop `source` au format du descripteur
de collection ci-dessus, et un slot Puck dont le contenu est rendu une fois par item
résolu, avec un contexte étendu `{ ...context, item }` pour que les composants
enfants du slot puissent binder sur `item.title`, `item.excerpt`, etc. Si le
resolver réel (track B) n'est pas encore fusionné, stubber une fonction
`resolveProps` factice au même signature en attendant. Consulter la doc Puck sur les
slots (`slot` field type) pour l'API exacte de composition.

#### Brief — Track D (Palette de composants)

Construire la bibliothèque de composants Puck de base : hero, grille de
fonctionnalités, CTA, carte d'article, nav, footer. Chaque composant est un fichier
séparé sous `ssg-src/components/`, exportant sa config Puck (`fields`, `render`).
Les props de style (couleur, espacement, typographie) émettent du style inline ou
des custom properties CSS — pas de pipeline Sass. Les composants statiques (hero,
CTA, grille) n'ont besoin de rien d'autre ; les composants qui listent des éléments
(nav, carte d'article en boucle) peuvent stubber le champ binding et le Repeater en
attendant que B et C soient fusionnés. Ne pas créer de fichier d'agrégation listant
tous les composants — ce sera fait en phase 2.

#### Brief — Track E (Flux RSS/sitemap)

Construire un générateur RSS (`ssg-src/feeds/rss.js`) et un générateur de sitemap
(`ssg-src/feeds/sitemap.js`), tous deux en JS pur produisant du XML à partir de
`context.collections` — remplace ce que Zola faisait via `generate_feed = true` et sa
config de sitemap intégrée. N'a besoin que de la forme de `collections` fixée en
Phase 0 (tableau d'objets `{ title, slug, url, date, excerpt, ... }` par groupe de
contenu), pas du reste du contexte.

## Vérification

Pas de suite automatisée dédiée pour l'instant. Le point de contrôle prototype (tâche
10) sert de première vérification de bout en bout : bindings + collections + slot API
de Puck coopérant sur un vrai cas d'usage (page d'index de blog). Les tests e2e
existants (`e2e/`) couvrent le flow Zola actuel et devront être adaptés une fois le
renderer Puck remplacé — pas avant que le point de contrôle prototype soit validé.
