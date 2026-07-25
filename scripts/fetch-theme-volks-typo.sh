#!/usr/bin/env bash
# Reconstruit themes/volks-typo/ depuis le dépôt source du thème Zola "volks-typo".
# Pas exécuté par `npm run build` — le thème ne change presque jamais, et ce script sert
# surtout à documenter d'où viennent ces fichiers pour une future mise à jour ou l'ajout
# d'un autre thème. À relancer seulement si on veut suivre une nouvelle version du thème.
#
# Le dépôt source n'a pas de theme.toml : ce n'est pas un thème Zola installable via
# `theme = "..."`, c'est un site Zola complet (sa propre démo) dont on copie
# templates/sass/static tels quels. Voir README.md, section "Génération du site".
#
# Le sass du thème est compilé ici, une fois, en CSS (static/main.css) — on ne garde
# jamais de sass/ dans le dépôt (voir site-builder.js, compile_sass = false : ça évite de
# repayer la compilation à chaque build, publication et surtout chaque aperçu live).
# `.standalone-page` (bloc CSS ci-dessous, PAGE_CSS_OVERRIDE) est un ajout hors thème
# d'origine (about.html/contact.html du thème sont chacune écrites pour une page précise,
# ça ne convient pas à une page quelconque créée via le CMS) : compilé depuis du sass à
# l'origine, il est réinjecté ici en CSS pur pour survivre à un re-vendoring.
#
# templates/index.html est modifié par rapport à la source (voir plus bas) — ne pas
# l'écraser bêtement en relançant ce script, vérifier le diff avant de committer.
set -euo pipefail

THEME_REPO="https://gitlab.com/tisgoud/zola-volks-typo-theme.git"
DEST="$(dirname "$0")/../themes/volks-typo"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Clonage de $THEME_REPO..."
git clone --depth 1 "$THEME_REPO" "$WORKDIR"

echo "Copie de templates/, static/ (hors contenu de démo)..."
rm -rf "$DEST/templates" "$DEST/static"
cp -r "$WORKDIR/templates" "$DEST/templates"
cp -r "$WORKDIR/static" "$DEST/static"
# Contenu de démo du thème (images des articles d'exemple, captures d'écran
# promotionnelles) : jamais référencé par nos propres templates/contenu.
rm -rf "$DEST/static/img" "$DEST/static/screenshots"

echo "Compilation du sass amont en CSS (static/main.css)..."
npx --yes sass "$WORKDIR/sass/main.scss" "$DEST/static/main.css" --no-source-map --style=compressed

echo "Ajout de la règle .standalone-page (hors thème d'origine)..."
cat >> "$DEST/static/main.css" <<'CSS'
.standalone-page .page-header{text-align:center;margin-bottom:calc(var(--grid-unit) * 8)}.standalone-page .page-title{font-family:var(--font-heading-primary);font-size:3.5rem;font-weight:900;color:var(--color-accent);text-transform:uppercase;letter-spacing:.05em;line-height:1.1;margin-bottom:calc(var(--grid-unit) * 3)}.standalone-page .content-section{line-height:1.7}.standalone-page .content-section h2{font-family:var(--font-heading-secondary);font-size:1.875rem;font-weight:700;color:var(--color-accent);text-transform:uppercase;letter-spacing:.1em;margin-top:calc(var(--grid-unit) * 6);margin-bottom:calc(var(--grid-unit) * 3)}.standalone-page .content-section p{font-size:1.125rem;line-height:1.6;color:var(--color-text-primary);margin-bottom:calc(var(--grid-unit) * 3)}.standalone-page .content-section ul{margin:calc(var(--grid-unit) * 2) 0;padding-left:calc(var(--grid-unit) * 3)}.standalone-page .content-section li{margin-bottom:calc(var(--grid-unit) * 2);font-size:1.125rem;line-height:1.6}@media (max-width: 768px){.standalone-page .page-title{font-size:2.5rem}.standalone-page .content-section h2{font-size:1.5rem}.standalone-page .content-section p,.standalone-page .content-section li{font-size:1rem}}
CSS

echo "Regénération du manifest.json (liste des fichiers pour le fetch() côté navigateur)..."
(
  cd "$DEST"
  node -e '
    const { execSync } = require("child_process");
    const files = execSync("find templates static -type f").toString().trim().split("\n").sort();
    require("fs").writeFileSync("manifest.json", JSON.stringify(files, null, 2) + "\n");
  '
)

echo "Fait. Ce script écrase templates/index.html (version modifiée, voir haut de" \
     "fichier) et supprime templates/standalone-page.html (n'existe pas en amont) :" \
     "restaure ces deux fichiers depuis git avant de committer (git checkout --" \
     "themes/volks-typo/templates/index.html, puis recrée standalone-page.html)."
