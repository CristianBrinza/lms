#!/usr/bin/env bash
# A fresh, consistent export of the production database to a file of your choosing, no questions:
#   deploy/server/export.sh /mnt/c/Users/crist/Documents/Shades\ Backups/lms/lms-2026-10-17.dump
# Custom-format pg_dump (one snapshot, so it is consistent while the app runs); restore it with
# deploy/server/restore.sh or the app's super-admin "Restore from backup". Exit code 0 only when the
# whole file was written; a partial file never takes the given name.
set -euo pipefail
out="${1:?usage: deploy/server/export.sh <outfile>}"
dir="$(dirname "$out")"
mkdir -p "$dir"
out="$(cd "$dir" && pwd)/$(basename "$out")" # absolute, before leaving the folder it was given from
cd "$(dirname "$0")/.."
part="$out.part"
trap 'rm -f "$part"' EXIT
docker compose exec -T postgres pg_dump -U lms -d lms -Fc >"$part"
# A custom-format dump starts with PGDMP; anything else (an error page, an empty file) is a failure.
[ "$(head -c 5 "$part")" = "PGDMP" ] || { echo "Export failed: not a database dump" >&2; exit 1; }
mv "$part" "$out"
trap - EXIT
echo "$out ($(du -h "$out" | cut -f1))"
