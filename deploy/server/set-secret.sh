#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Puts one secret into deploy/.env without showing it, then restarts the app with it.
#   deploy/server/set-secret.sh TMDB_API_KEY
# The value is asked for (hidden), never echoed, never written to the shell history.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

name="${1:-}"
[[ "$name" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "Usage: $0 NAME   (for example TMDB_API_KEY)"; exit 1; }
[ -f .env ] || { echo "deploy/.env is missing: run setup.sh first."; exit 1; }

read -rsp "Paste ${name} (it stays hidden), then Enter: " value
echo
[ -n "$value" ] || { echo "Nothing pasted: nothing changed."; exit 1; }
case "$value" in *$'\n'*|*'"'*) echo "That value has a line break or a quote: nothing changed."; exit 1;; esac

tmp="$(mktemp .env.XXXXXX)"
chmod 600 "$tmp"
grep -v "^${name}=" .env > "$tmp" || true
printf '%s=%s\n' "$name" "$value" >> "$tmp"
mv "$tmp" .env
chmod 600 .env
unset value
echo "Saved ${name} in deploy/.env (the value stays hidden)."

echo "Restarting the app with it…"
docker compose up -d api >/dev/null
echo "Done."
