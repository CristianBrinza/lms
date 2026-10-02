#!/usr/bin/env bash
# A backup now, next to the nightly ones:  deploy/server/backup-now.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/manual-$(date '+%Y%m%d-%H%M%S').dump"
docker compose exec -T postgres pg_dump -U lms -d lms -Fc >"$file"
echo "$file ($(du -h "$file" | cut -f1))"
