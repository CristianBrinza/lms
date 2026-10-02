#!/bin/sh
# Nightly backups of the LMS database (the `backup` service in docker-compose.yml): at BACKUP_AT
# every day a custom-format pg_dump to /backups (deploy/backups on the machine), keeping KEEP_DAYS
# days of them. The updater adds a pre-update dump before every update; those are kept as long.
#
# Restore: deploy/server/restore.sh deploy/backups/<file>.dump
set -u
AT="${BACKUP_AT:-03:30}"
KEEP="${KEEP_DAYS:-14}"
mkdir -p /backups
echo "backups at $AT every day, kept $KEEP days"
last=""
while true; do
  now="$(date +%H:%M)"
  today="$(date +%F)"
  if [ "$now" = "$AT" ] && [ "$last" != "$today" ]; then
    file="/backups/lms-$today.dump"
    if pg_dump -Fc -f "$file.part" && mv "$file.part" "$file"; then
      echo "$(date '+%F %T') backup $(basename "$file") $(du -h "$file" | cut -f1)"
    else
      rm -f "$file.part"
      echo "$(date '+%F %T') backup FAILED"
    fi
    find /backups -name '*.dump' -type f -mtime +"$KEEP" -print -delete
    last="$today"
  fi
  sleep 30
done
