# AGENTS.md

Conventions for AI agents working on this repo.

## Status

This project is at an early, pre-code stage. Linting, test, and language-specific
conventions aren't defined yet — add sections here once the stack is chosen.

## Lima devbox VM

If the `CMSTATIC_DEVBOX` environment variable is set, you're running inside the
Lima devbox VM created by `scripts/host-create-vm.sh`. Implications:

- The project directory is mounted read-write from the host
- `~/.claude` is shared with the host (symlinked), so Claude Code config/auth carries over
