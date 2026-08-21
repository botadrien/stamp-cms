#!/usr/bin/env bash
# Runs inside the Lima VM. Called by host-create-vm.sh.
# Required env vars: PROJECT_DIR, HOST_HOME, VM_NAME

set -euo pipefail

sudo apt-get update -y
sudo apt-get install -y build-essential curl git vim tmux dnsutils gh docker.io docker-compose-v2

sudo systemctl disable --now motd-news.timer # ubuntu ad banner

# docker (used to run a local Forgejo instance for e2e tests)
sudo usermod -aG docker "$(whoami)"
sudo systemctl enable --now docker
# group membership only applies to new sessions; this script itself keeps using sudo/sg
# where needed, but a fresh `limactl shell` afterwards can run docker without either

# gh config lives on the host disk so its own auth (separate from the host's account)
# survives VM recreation instead of requiring `gh auth login` every time
mkdir -p ~/.config "$PROJECT_DIR/tmp/lima-vm-cache/gh-config"
rm -rf ~/.config/gh && ln -s "$PROJECT_DIR/tmp/lima-vm-cache/gh-config" ~/.config/gh
gh auth setup-git || echo "gh non authentifié pour l'instant — lancez 'gh auth login && gh auth setup-git' une fois connecté"

# mise (language version manager) + node, pinned in mise.toml
rm -rf ~/.local && ln -s "$PROJECT_DIR/tmp/lima-vm-cache/local" ~/.local
curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
cd "$PROJECT_DIR" && mise trust && mise install && mise reshim
echo 'eval "$($HOME/.local/bin/mise activate bash)"' >> ~/.bashrc
export PATH="$HOME/.local/share/mise/shims:$PATH"

# Playwright + Chromium, for e2e browser tests against the POC + local Forgejo.
# node_modules is already populated (host-mounted), so this uses the project's
# own pinned @playwright/test instead of a separately-versioned global install.
#
# Resolved to the real npx binary/dir (not the mise shim) because under sudo,
# mise's shim can't read ~/.config/mise/config.toml (HOME points at root's) and
# errors with "npx is not a valid shim"; the real dir must lead PATH too since
# npx's shebang re-execs `node`, which would otherwise hit the same broken shim.
NPX_BIN="$(mise which npx)"
NPX_DIR="$(dirname "$NPX_BIN")"
sudo env "PATH=$NPX_DIR:$PATH" "$NPX_BIN" playwright install --with-deps chromium
npx playwright install chromium # browser binary itself must also be installed as this user, not just root

# tweaks
echo "cd $PROJECT_DIR" >> ~/.bashrc # always open the terminal in the repo
echo "export CMSTATIC_DEVBOX=${VM_NAME}" >> ~/.bashrc # lets agents detect they're running in the VM

# Claude Code
curl -fsSL https://claude.ai/install.sh | bash
echo 'alias claude="claude --dangerously-skip-permissions"' >> ~/.bashrc
rm -rf ~/.claude && ln -s "$HOST_HOME/.claude" ~/.claude
