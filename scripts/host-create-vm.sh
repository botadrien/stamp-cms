#!/usr/bin/env bash
# Creates a Lima devbox VM for this project. Run from the repo root.
#
# Usage: scripts/host-create-vm.sh

set -euo pipefail

PROJECT_DIR="$(pwd)"
VM_NAME="cmstatic-devbox"
SCRIPTS_DIR="$PROJECT_DIR/scripts"

if limactl list --format='{{.Name}}' | grep -qx "$VM_NAME"; then
  echo "==> Deleting existing Lima VM '$VM_NAME'…"
  limactl delete --force "$VM_NAME"
fi

mkdir -p "$PROJECT_DIR/tmp/lima-vm-cache/local"

limactl start template:ubuntu-24.04 --name="$VM_NAME" --cpus=4 --memory=4 --disk=20 -y \
  --set ".mounts[0] = {\"location\": \"$PROJECT_DIR\", \"writable\": true}" \
  --set ".mounts[1] = {\"location\": \"$HOME/.claude\", \"writable\": true}"

echo "==> Installing dependencies in the VM…"
limactl shell "$VM_NAME" -- env PROJECT_DIR="$PROJECT_DIR" HOST_HOME="$HOME" VM_NAME="$VM_NAME" bash "$SCRIPTS_DIR/vm-setup.sh"

limactl copy "$HOME/.claude.json" "$VM_NAME:.claude.json"

echo ""
echo "VM '$VM_NAME' is ready. Run: limactl shell $VM_NAME"
