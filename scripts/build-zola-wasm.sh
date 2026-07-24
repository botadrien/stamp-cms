#!/usr/bin/env bash
# Reconstruit vendor/zola.wasm depuis les sources patchées de dstaley/zola (branche "wasm").
# Pas exécuté par `npm run build` — trop lourd (toolchain Rust + wasi-sdk) pour un flux de
# dev habituel, et zola.wasm ne change presque jamais. À relancer seulement si on doit
# changer de version de Zola ou retoucher les patches WASI.
#
# Origine des patches (rayon désactivé, canonicalize() contourné sur WASI, libsass
# remplacé par grass) : https://dstaley.com/posts/running-zola-on-wasm/
set -euo pipefail

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Toolchain..."
command -v cargo >/dev/null || { echo "cargo introuvable — installe Rust (https://rustup.rs)"; exit 1; }
rustup target add wasm32-wasip1

if [ -z "${WASI_SDK:-}" ]; then
  echo "Variable WASI_SDK non définie — télécharge wasi-sdk (https://github.com/WebAssembly/wasi-sdk/releases)"
  echo "et exporte WASI_SDK=/chemin/vers/wasi-sdk-XX.Y-<arch>-<os> avant de relancer ce script."
  exit 1
fi

echo "Clonage de dstaley/zola (branche wasm)..."
git clone --branch wasm --depth 1 https://github.com/dstaley/zola "$WORKDIR/zola"
cd "$WORKDIR/zola"

# Le lockfile d'origine (2023) pointe vers un wasm-bindgen trop ancien pour les rustc
# récents — on le fait avancer vers une version compatible.
cargo update -p wasm-bindgen --precise 0.2.88

echo "Build (peut prendre plusieurs minutes)..."
CC_wasm32_wasip1="$WASI_SDK/bin/clang" \
CARGO_TARGET_WASM32_WASIP1_LINKER="$WASI_SDK/bin/clang" \
RUSTFLAGS="-C target-feature=-crt-static" \
CARGO_PROFILE_RELEASE_LTO=off \
CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 \
cargo build --target wasm32-wasip1 --no-default-features --release
# LTO désactivé et codegen-units augmenté : le profil release par défaut de Zola (LTO +
# codegen-units=1) demande plus de mémoire que disponible sur une machine de dev/CI
# modeste (observé : SIGKILL/OOM avec ~4 Go de RAM). Binaire un peu plus gros/moins
# optimisé en échange d'un build qui aboutit.

OUT="$(dirname "$0")/../vendor/zola.wasm"
cp target/wasm32-wasip1/release/zola.wasm "$OUT"
echo "Écrit dans $OUT ($(du -h "$OUT" | cut -f1))"
