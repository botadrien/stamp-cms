# AGENTS.md

Conventions for AI agents working on this repo.

## Status

This project is at an early, pre-code stage. Linting and language-specific conventions
aren't defined yet — add sections here once the stack is chosen.

## Tests

e2e tests (`e2e/`) run Playwright against a real local Forgejo instance (Docker) rather
than mocking API calls — see the "Tests e2e" section in `README.md` for how to run them
(`npm run e2e`). Requires Docker.

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
