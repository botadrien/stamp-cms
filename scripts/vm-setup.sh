#!/usr/bin/env bash
# Runs inside the Lima VM. Called by host-create-vm.sh.
# Required env vars: PROJECT_DIR, HOST_HOME, VM_NAME

set -euo pipefail

sudo apt-get update -y
sudo apt-get install -y build-essential curl git vim tmux dnsutils gh

sudo systemctl disable --now motd-news.timer # ubuntu ad banner

# gh config lives on the host disk so its own auth (separate from the host's account)
# survives VM recreation instead of requiring `gh auth login` every time
mkdir -p ~/.config "$PROJECT_DIR/tmp/lima-vm-cache/gh-config"
rm -rf ~/.config/gh && ln -s "$PROJECT_DIR/tmp/lima-vm-cache/gh-config" ~/.config/gh

# mise (language version manager, for whatever runtime this project ends up using)
rm -rf ~/.local && ln -s "$PROJECT_DIR/tmp/lima-vm-cache/local" ~/.local
curl https://mise.run | sh
export PATH="$HOME/.local/bin:$PATH"
cd "$PROJECT_DIR" && mise trust 2>/dev/null || true
echo 'eval "$($HOME/.local/bin/mise activate bash)"' >> ~/.bashrc
export PATH="$HOME/.local/share/mise/shims:$PATH"

# tweaks
echo "cd $PROJECT_DIR" >> ~/.bashrc # always open the terminal in the repo
echo "export CMSTATIC_DEVBOX=${VM_NAME}" >> ~/.bashrc # lets agents detect they're running in the VM

# Claude Code
curl -fsSL https://claude.ai/install.sh | bash
echo 'alias claude="claude --dangerously-skip-permissions"' >> ~/.bashrc
rm -rf ~/.claude && ln -s "$HOST_HOME/.claude" ~/.claude
