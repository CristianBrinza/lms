#!/usr/bin/env bash
# Puts a backup back into the LMS database:  deploy/server/restore.sh deploy/backups/<file>.dump
# The API is stopped meanwhile; a safety dump of the current data is taken first.
set -euo pipefail
file="${1:?usage: deploy/server/restore.sh deploy/backups/<file>.dump}"
[ -s "$file" ] || { echo "No such backup: $file" >&2; exit 1; }
file="$(cd "$(dirname "$file")" && pwd)/$(basename "$file")" # before leaving the folder it was given from
cd "$(dirname "$0")/.."
read -r -p "Replace the database with $(basename "$file")? Type yes: " answer
[ "$answer" = "yes" ] || { echo "Nothing changed."; exit 1; }

safety="backups/before-restore-$(date '+%Y%m%d-%H%M%S').dump"
docker compose exec -T postgres pg_dump -U lms -d lms -Fc >"$safety"
echo "Current data saved to $safety"
docker compose stop api updater
docker compose exec -T postgres pg_restore -U lms -d lms --clean --if-exists --no-owner <"$file"
docker compose start api updater
echo "Restored $(basename "$file"). Check: deploy/server/status.sh"
