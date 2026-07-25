# AGENTS.md

Conventions for AI agents working on this repo.

## Status

Vanilla JS front end (`app.js`, `api.js`, `site-builder.js`), no framework/bundler at
runtime except for the rich editor (`editor-src/`, built with esbuild into
`editor.bundle.js`/`.css` and `zola-builder.bundle.js` — run `npm run build` after
editing anything under `editor-src/`, it's not picked up live). No linter configured yet.

Every site is built with a single hardcoded theme, vendored under `themes/volks-typo/`
(`CURRENT_THEME` in `site-builder.js` — see that file's comment for the intended
theme-picker hook). Content under `content/` is split into standalone pages
(`content/*.md`) and blog posts (`content/blog/*.md`), surfaced as two separate groups
in the "pages du site" screen (`app.js`: `listContentPages`/`renderPageGroup`).

## Tests

e2e tests (`e2e/`) run Playwright against a real local Forgejo instance (Docker) rather
than mocking API calls — see the "Tests e2e" section in `README.md` for how to run them
(`npm run e2e`). Requires Docker.

- **Docker permission denied even though `vm-setup.sh` added the user to the `docker`
  group**: group membership only takes effect in new sessions. If you're in a shell
  that predates the `usermod`, prefix Docker/Compose commands with `sg docker -c "..."`
  instead of opening a new shell (e.g. `sg docker -c "npm run e2e"`).
- Each in-browser Zola rebuild (triggered by "Publier", site creation, or saving blog
  settings) takes **~11-15s** with the full volks-typo theme (fonts, search index —
  the theme's Sass is precompiled to `static/main.css` ahead of time, `compile_sass =
  false`, so it's no longer part of this cost) — assertions waiting on a post-publish
  status use 60s timeouts
  (`e2e/playwright.config.mjs`'s global timeout is 120s to match). Don't reintroduce
  short (~10s) timeouts on anything that triggers `rebuildAndPublishSite()`.
- Tests that publish run against a **dedicated repo created via the Forgejo API in the
  test itself** (`site-settings-and-split.spec.mjs`, `legacy-content.spec.mjs`), not the
  shared `seed.repoName` — tests run with 2 workers, and two tests republishing the same
  repo concurrently causes real write collisions.
- If a test run flakes on something unrelated to build time (e.g. a plain API-conflict
  check with no rebuild involved), suspect resource contention from concurrent Zola
  builds in other tests rather than a product bug — rerun once against a fresh reseed
  (`docker compose -f e2e/docker-compose.yml down -v --remove-orphans` then
  `npm run e2e:up`) before treating it as a real failure.

## vendor/zola.wasm

Committed as a binary, not built by `npm run build` (see "Génération du site (Zola en
WebAssembly)" in `README.md`). Only rebuild it (`scripts/build-zola-wasm.sh`) if you
need a different Zola version or to touch the WASI patches — it needs a Rust toolchain
+ wasi-sdk, and on a memory-constrained machine (~4GB) the default release profile
(LTO + codegen-units=1) OOMs during linking; the script already works around that.

## Lima devbox VM

If the `CMSTATIC_DEVBOX` environment variable is set, you're running inside the
Lima devbox VM created by `scripts/host-create-vm.sh`. Implications:

- The project directory is mounted read-write from the host
- `~/.claude` is shared with the host (symlinked), so Claude Code config/auth carries over
