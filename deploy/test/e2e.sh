#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# End-to-end test of the production pipeline, on this machine's Docker:
#
#   a bare git repo plays GitHub, a local registry plays ghcr.io, a fresh clone plays the
#   production PC running the real deploy/docker-compose.yml (updater, backups) — under its own
#   project name and ports, so a dev database next to it is never touched.
#
#   1. v1 published → the stack starts; the API answers only with the proxy key
#   2. v2 published → the updater backs up, switches, the API reports v2
#   3. a broken v3  → the updater rolls back to v2 by itself and keeps skipping v3
#   4. a deploy-file change pushed → the PC's checkout follows; still v2 (v3 stays skipped)
#   5. v4 published → it goes live; the skip is forgotten
#   6. a backup now, and a restore of it
#
#   deploy/test/e2e.sh            (KEEP=1 leaves everything up to look at)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${WORK:-$(mktemp -d "${TMPDIR:-/tmp}/lms-e2e.XXXXXX")}"
WORK="$(cd "$WORK" && pwd -P)"
PORT=5055
REGISTRY="localhost:$PORT"
IMAGE="$REGISTRY/lms-api"
PROJECT=lms-e2e
PROD="$WORK/prod"
DEV="$WORK/dev"
ORIGIN="$PROD/.git/e2e-origin.git" # inside the PC's .git: the updater sees it at the same path
PASSED=0

step() { printf '\n\033[1m── %s\033[0m\n' "$*"; }
ok() { PASSED=$((PASSED + 1)); printf '\033[32mPASS\033[0m  %s\n' "$*"; }
die() { printf '\033[31mFAIL\033[0m  %s\n' "$*" >&2; dump; exit 1; }
dump() {
  echo "── updater log"; (cd "$PROD/deploy" && docker compose logs --tail 40 updater) 2>/dev/null || true
  echo "── status"; cat "$PROD/deploy/state/status.json" 2>/dev/null || true
}
cleanup() {
  if [ "${KEEP:-}" = "1" ]; then echo "KEEP=1: left $WORK and project $PROJECT running"; return; fi
  # The updater first: otherwise it brings the API back up while the rest goes down.
  (cd "$PROD/deploy" 2>/dev/null && docker compose stop updater >/dev/null 2>&1 && docker compose down -v --remove-orphans >/dev/null 2>&1) || true
  docker rm -f lms-e2e-registry >/dev/null 2>&1 || true
  docker image rm -f lms-api:current >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

publish() {
  # publish <version> [broken]
  local version="$1"
  if [ "${2:-}" = "broken" ]; then
    printf 'FROM %s:main\nCMD ["node", "-e", "console.error(\\"broken on purpose\\"); process.exit(1)"]\n' "$IMAGE" |
      docker build -q -t "$IMAGE:main" - >/dev/null
  else
    docker build -q --build-arg "APP_VERSION=$version" -t "$IMAGE:main" "$ROOT/backend" >/dev/null
  fi
  docker push -q "$IMAGE:main" >/dev/null
  echo "published $IMAGE:main ($version${2:+, $2})"
}
health() {
  # The API's /api/health version, asked with (or without) the proxy key.
  local key="${1:-}"
  curl -s --max-time 5 ${key:+-H "x-lms-proxy-key: $key"} -o /tmp/lms-e2e-health.json -w '%{http_code}' "http://127.0.0.1:18790/api/health" || echo 000
}
version() { [ "$(health "$SECRET")" = 200 ] && jq -r .version /tmp/lms-e2e-health.json || echo ""; }
wait_for() {
  # wait_for <seconds> <description> <command…>
  local seconds="$1" what="$2"
  shift 2
  for _ in $(seq 1 "$seconds"); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  die "timed out waiting: $what"
}
status_is() { [ "$(jq -r .result "$PROD/deploy/state/status.json" 2>/dev/null)" = "$1" ] && [ "$(jq -r .version "$PROD/deploy/state/status.json" 2>/dev/null)" = "$2" ]; }
version_is() { [ "$(version)" = "$1" ]; }

step "Setting up in $WORK"
docker rm -f lms-e2e-registry >/dev/null 2>&1 || true
docker run -d --name lms-e2e-registry -p "$PORT:5000" registry:2 >/dev/null
# "GitHub": the repo as it is now (working tree included), pushed to a bare origin.
git clone -q "$ROOT" "$DEV"
rsync -a --delete --exclude .git --exclude node_modules --exclude dist --exclude 'deploy/.env' --exclude 'deploy/backups' --exclude 'deploy/state' "$ROOT/" "$DEV/"
git -C "$DEV" add -A && git -C "$DEV" -c user.name=e2e -c user.email=e2e@test commit -q -m "e2e: the working tree" || true
git clone -q "$DEV" "$PROD"
git clone -q --bare "$DEV" "$ORIGIN"
git -C "$PROD" remote set-url origin "$ORIGIN"
git -C "$DEV" remote set-url origin "$ORIGIN"
git -C "$PROD" fetch -q origin && git -C "$PROD" branch -q -u origin/"$(git -C "$PROD" rev-parse --abbrev-ref HEAD)" 2>/dev/null || true
BRANCH="$(git -C "$PROD" rev-parse --abbrev-ref HEAD)"
SECRET="$(openssl rand -hex 24)"
cat >"$PROD/deploy/.env" <<ENV
COMPOSE_PROJECT_NAME=$PROJECT
COMPOSE_FILE=docker-compose.yml:test/docker-compose.e2e.yml
LMS_HOST_DIR=$PROD
LMS_BRANCH=$BRANCH
LMS_IMAGE=$IMAGE
CHECK_EVERY=3
HEALTH_TIMEOUT=60
TZ=Europe/Chisinau
POSTGRES_PASSWORD=$(openssl rand -hex 16)
APP_URL=https://lms.e2e.test
JWT_SECRET=$(openssl rand -hex 32)
PROXY_SECRET=$SECRET
TUNNEL_TOKEN=unused-in-the-test
ADMIN_EMAIL=admin@e2e.test
ADMIN_PASSWORD=e2e-password-123456
ADMIN_NAME=E2E
ADMIN_SURNAME=Test
ENV
ok "origin, registry and the PC's checkout ready (branch $BRANCH)"

step "1. v1: first start"
publish e2e-v1
(cd "$PROD/deploy" && docker compose up -d --build --quiet-pull >/dev/null 2>&1) || die "compose up failed"
wait_for 120 "v1 healthy" version_is e2e-v1
ok "the API runs v1"
code="$(health)"
[ "$code" = 404 ] && ok "without the proxy key: 404" || die "without the proxy key: $code"
(cd "$PROD/deploy" && docker compose ps --services --status running) | sort | tr '\n' ' ' | grep -q 'api backup postgres updater' && ok "postgres, api, updater, backup running (no tunnel in the test)" || die "services: $(cd "$PROD/deploy" && docker compose ps --services --status running | tr '\n' ' ')"

step "2. v2: an update"
publish e2e-v2
wait_for 120 "v2 live" status_is ok e2e-v2
ok "the updater switched to v2"
ls "$PROD/deploy/backups"/pre-update-*.dump >/dev/null 2>&1 && ok "a backup was taken first ($(ls "$PROD/deploy/backups" | head -n1))" || die "no pre-update backup"

step "3. A broken v3: roll back"
publish e2e-v3 broken
wait_for 180 "rolled back" status_is rolled-back e2e-v2
ok "v3 wasn't healthy: back on v2 by itself"
[ -s "$PROD/deploy/state/bad-image" ] && ok "v3 is remembered as bad" || die "no bad-image mark"
sleep 8
version_is e2e-v2 && ok "still v2 a few rounds later (v3 skipped, not retried)" || die "not on v2 any more: $(version)"
(cd "$PROD/deploy" && docker compose restart api >/dev/null 2>&1)
wait_for 60 "v2 after a restart" version_is e2e-v2
ok "a restart (like a reboot) still runs v2, not the bad v3"

step "4. A deploy-file change"
echo "# e2e: a change to the deploy files" >>"$DEV/deploy/test/docker-compose.e2e.yml"
git -C "$DEV" -c user.name=e2e -c user.email=e2e@test commit -qam "e2e: change the deploy files"
git -C "$DEV" push -q origin "HEAD:$BRANCH"
target="$(git -C "$DEV" rev-parse HEAD)"
wait_for 60 "the PC's checkout follows" bash -c "[ \"\$(git -C '$PROD' rev-parse HEAD)\" = '$target' ]"
ok "the PC fast-forwarded to $(git -C "$PROD" rev-parse --short HEAD)"
sleep 6
version_is e2e-v2 && ok "and still runs v2 (the bad v3 isn't picked up by the redeploy)" || die "version $(version)"

step "5. v4: a good one again"
publish e2e-v4
wait_for 120 "v4 live" status_is ok e2e-v4
ok "v4 is live"
[ ! -e "$PROD/deploy/state/bad-image" ] && ok "the bad mark is gone" || die "bad-image still there"

step "6. Backup and restore"
file="$(cd "$PROD" && deploy/server/backup-now.sh | awk '{print $1}')"
[ -s "$PROD/deploy/$file" ] && ok "backup-now: $file" || die "backup-now made nothing"
users_before="$(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -tAc 'select count(*) from users')"
(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -qc "insert into households (id, name) values (gen_random_uuid(), 'after the backup')")
(cd "$PROD" && echo yes | deploy/server/restore.sh "deploy/$file" >/dev/null 2>&1) || die "restore failed"
gone="$(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -tAc "select count(*) from households where name = 'after the backup'")"
users_after="$(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -tAc 'select count(*) from users')"
[ "$gone" = 0 ] && [ "$users_before" = "$users_after" ] && ok "restored: the later row is gone, the $users_after user(s) kept" || die "restore: later rows $gone, users $users_before→$users_after"
wait_for 60 "API back after the restore" version_is e2e-v4
ok "the API is back on v4"

printf '\n\033[32m%d checks passed\033[0m\n' "$PASSED"
