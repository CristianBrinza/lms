#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Put this checkout live now, local changes included. On the production machine, after changing
# something here:   deploy/server/live.sh            (checks first: typecheck, lint, tests, builds)
#                   deploy/server/live.sh --no-checks (straight to the release)
#
# The release is the updater's: build the image, back the database up, switch, health check,
# and the previous version back if the new one isn't healthy. Then commit and push, so the other
# machines get the change (the updater doesn't pull while this checkout has local changes).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" != "--no-checks" ]; then
  if command -v yarn >/dev/null && [ -d ../backend/node_modules ] && [ -d ../frontend/node_modules ]; then
    echo "── Checks (yarn verify; the tests use the dev database, yarn db:up)"
    (cd .. && yarn --silent db:up >/dev/null && yarn verify) || { echo "Checks failed: nothing changed."; exit 1; }
  else
    echo "── No checks: Node and the dependencies aren't installed here (yarn setup). The build still typechecks the web app."
  fi
fi

docker compose ps -q updater | grep -q . || { echo "The updater isn't running: docker compose up -d updater"; exit 1; }
echo "── Release (build, backup, switch, health check)"
if docker compose exec -T updater lms-update --release; then
  docker compose exec -T updater cat state/status.json 2>/dev/null || true
  echo
  echo "Live. Commit and push when it's right:  git add -A && git commit -m '…' && git push"
else
  echo "Not released: see above (and deploy/state/build.log). What ran before is still running."
  exit 1
fi
