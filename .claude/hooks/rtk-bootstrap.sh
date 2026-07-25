#!/usr/bin/env bash
# Idempotent SessionStart bootstrap for rtk (https://github.com/rtk-ai/rtk).
# Committed to the repo because this project runs on ephemeral VMs where
# ~/.local/bin and ~/.claude/settings.json do not survive a rebuild — only
# what's checked into git does. Safe to run on every session start.

set -u

# Already installed and it's the right "rtk" (rtk-ai/rtk, not the unrelated
# "Rust Type Kit" crate that also registers a `rtk` binary)?
if command -v rtk >/dev/null 2>&1 && rtk gain >/dev/null 2>&1; then
  exit 0
fi

# Prefer a system-wide location already on PATH for every shell (no rc-file
# sourcing to rely on). Falls back to ~/.local/bin + a one-time PATH export
# when passwordless sudo isn't available.
if sudo -n true 2>/dev/null; then
  export RTK_INSTALL_DIR=/usr/local/bin
  INSTALL_CMD="sudo -n env RTK_INSTALL_DIR=$RTK_INSTALL_DIR sh"
else
  INSTALL_DIR="$HOME/.local/bin"
  export RTK_INSTALL_DIR="$INSTALL_DIR"
  INSTALL_CMD="sh"
  mkdir -p "$INSTALL_DIR"
  for rc in "$HOME/.bashrc" "$HOME/.profile"; do
    [ -f "$rc" ] || continue
    grep -qF "$INSTALL_DIR" "$rc" 2>/dev/null || \
      echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$rc"
  done
  export PATH="$INSTALL_DIR:$PATH"
fi

curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | $INSTALL_CMD \
  || echo "[rtk-bootstrap] install failed, hook will no-op until rtk is installed" >&2
