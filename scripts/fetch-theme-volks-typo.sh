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
# templates/index.html et sass/_pages.scss (ajout de la classe .standalone-page) sont
# modifiés par rapport à la source — ne pas les écraser bêtement en relançant ce script,
# vérifier le diff avant de committer.
set -euo pipefail

THEME_REPO="https://gitlab.com/tisgoud/zola-volks-typo-theme.git"
DEST="$(dirname "$0")/../themes/volks-typo"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Clonage de $THEME_REPO..."
git clone --depth 1 "$THEME_REPO" "$WORKDIR"

echo "Copie de templates/, sass/, static/ (hors contenu de démo)..."
rm -rf "$DEST/templates" "$DEST/sass" "$DEST/static"
cp -r "$WORKDIR/templates" "$DEST/templates"
cp -r "$WORKDIR/sass" "$DEST/sass"
cp -r "$WORKDIR/static" "$DEST/static"
# Contenu de démo du thème (images des articles d'exemple, captures d'écran
# promotionnelles) : jamais référencé par nos propres templates/contenu.
rm -rf "$DEST/static/img" "$DEST/static/screenshots"

echo "Regénération du manifest.json (liste des fichiers pour le fetch() côté navigateur)..."
(
  cd "$DEST"
  node -e '
    const { execSync } = require("child_process");
    const files = execSync("find templates sass static -type f").toString().trim().split("\n").sort();
    require("fs").writeFileSync("manifest.json", JSON.stringify(files, null, 2) + "\n");
  '
)

echo "Fait. Ce script écrase templates/index.html et sass/_pages.scss (versions" \
     "modifiées, voir haut de fichier) et supprime templates/standalone-page.html" \
     "(n'existe pas en amont) : restaure ces trois fichiers depuis git avant de" \
     "committer (git checkout -- themes/volks-typo/templates/index.html ..., puis" \
     "réapplique le diff sur _pages.scss et recrée standalone-page.html)."
