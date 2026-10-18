#!/usr/bin/env bash
# Stores the Claude Code subscription token (from `claude setup-token`) for the in-app assistant.
# Saved to ~/.config/lms/assistant.env (chmod 600), read by the assistant bridge. Never echoed.
set -euo pipefail
dir="$HOME/.config/lms" && mkdir -p "$dir" && chmod 700 "$dir"
file="$dir/assistant.env"
read -rsp 'Claude token (sk-ant-oat…): ' token
echo; token="$(printf %s "$token" | tr -d "[:space:]")"
[[ $token == sk-ant-* ]] || { echo 'That does not look like a Claude Code token (it starts with sk-ant-).'; exit 1; }
touch "$file" && chmod 600 "$file"
grep -v '^CLAUDE_CODE_OAUTH_TOKEN=' "$file" > "$file.tmp" || true
printf 'CLAUDE_CODE_OAUTH_TOKEN=%s\n' "$token" >> "$file.tmp"
mv "$file.tmp" "$file" && chmod 600 "$file"
echo 'Saved. The assistant bridge picks it up on its next start.'
