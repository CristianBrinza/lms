#!/usr/bin/env bash
# Makes the two access keys the in-app assistant bridge needs and writes them to
# ~/.config/lms/assistant.env (chmod 600). Keys are never printed.
#   deploy/server/set-assistant-key.sh <admin-email>
set -euo pipefail
cd "$(dirname "$0")/.."
email="${1:-}"
[ -n "$email" ] || { echo 'Usage: deploy/server/set-assistant-key.sh <admin-email>'; exit 1; }

make_key() { # name, scope
  docker compose exec -T api node dist/create-key.cjs --email "$email" --name "$1" --scope "$2" 2>/dev/null
}
bridge_key="$(make_key 'Assistant bridge' assistant-bridge)" || { echo 'Could not create the bridge key (is the API running, and is the email an active account?).'; exit 1; }
mcp_key="$(make_key 'Assistant MCP' food)" || { echo 'Could not create the MCP key.'; exit 1; }
[[ $bridge_key == lms_* && $mcp_key == lms_* ]] || { echo 'The API did not return keys.'; exit 1; }

umask 077
dir="$HOME/.config/lms" && mkdir -p "$dir" && chmod 700 "$dir"
file="$dir/assistant.env"
touch "$file" && chmod 600 "$file"
{
  grep -E '^CLAUDE_CODE_OAUTH_TOKEN=' "$file" || true
  printf 'LMS_URL=%s\n' 'http://127.0.0.1:8790'
  printf 'LMS_BRIDGE_KEY=%s\n' "$bridge_key"
  printf 'LMS_MCP_KEY=%s\n' "$mcp_key"
} > "$file.tmp"
mv "$file.tmp" "$file" && chmod 600 "$file"
unset bridge_key mcp_key
echo 'Bridge key written. MCP key written.'
echo 'Restart the bridge if it runs:  systemctl --user restart lms-assistant-bridge'
