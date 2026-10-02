#!/usr/bin/env bash
# What the LMS server is doing: the containers, the API's version and health, the updater's last
# result, the last backups.   deploy/server/status.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

echo "── Containers"
docker compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'

echo
echo "── API"
container="$(docker compose ps -q api 2>/dev/null)"
if [ -n "$container" ]; then
  docker exec "$container" node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{headers:{'x-lms-proxy-key':process.env.PROXY_SECRET||''}}).then(r=>r.json()).then(b=>console.log(JSON.stringify(b,null,2))).catch(e=>console.log('unreachable: '+e.message))"
else
  echo "not running"
fi

echo
echo "── Updater (deploy/state/status.json)"
cat state/status.json 2>/dev/null || echo "no update yet"
echo
docker compose logs --tail 5 updater 2>/dev/null | sed 's/^/  /'

echo
echo "── Backups (deploy/backups)"
ls -lht backups/*.dump 2>/dev/null | head -n 5 | awk '{print "  " $6, $7, $8, $5, $9}' || echo "  none yet"
echo
echo "── Code: $(git log -1 --format='%h %s (%cr)')"
