#!/usr/bin/env bash
# Installs and starts the assistant bridge as a systemd user service (idempotent).
#   deploy/assistant-bridge/install.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
unit=lms-assistant-bridge.service

[ -f "$HOME/.config/lms/assistant.env" ] || echo "Note: ~/.config/lms/assistant.env is missing; run deploy/server/set-assistant-key.sh <admin-email> first."

mkdir -p "$HOME/.config/systemd/user"
install -m 644 "$here/$unit" "$HOME/.config/systemd/user/$unit"

if [ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null)" != yes ]; then
  loginctl enable-linger "$USER" 2>/dev/null || echo "Could not enable lingering without sudo. Run once:  sudo loginctl enable-linger $USER"
fi

systemctl --user daemon-reload
systemctl --user enable --now lms-assistant-bridge
systemctl --user restart lms-assistant-bridge
systemctl --user --no-pager status lms-assistant-bridge | head -n 12 || true
