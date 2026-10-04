#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# End-to-end test of production, on this machine's Docker:
#
#   a bare git repo plays GitHub, a fresh clone plays the production PC running the real
#   deploy/docker-compose.yml (updater, backups; no tunnel) — under its own project name and
#   ports, so a dev database next to it is never touched.
#
#   1. first start: the PC builds the app from its checkout; web app + API answer
#   2. a commit pushed → the updater pulls it, backs up, rebuilds, switches
#   3. a broken commit → unhealthy → back on the previous version, and not retried
#   4. a fix pushed → live; the bad mark is gone
#   5. an edit made on the PC → the updater doesn't pull over it; live.sh puts it live
#   6. a backup now, and a restore of it
#
#   deploy/test/e2e.sh            (KEEP=1 leaves everything up to look at)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${WORK:-$(mktemp -d "${TMPDIR:-/tmp}/lms-e2e.XXXXXX")}"
WORK="$(cd "$WORK" && pwd -P)"
PROJECT=lms-e2e
PROD="$WORK/prod"
DEV="$WORK/dev"
ORIGIN="$PROD/.git/e2e-origin.git" # inside the PC's .git: the updater sees it at the same path
URL=http://127.0.0.1:18790
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
  # The updater first: otherwise it brings the app back up while the rest goes down.
  (cd "$PROD/deploy" 2>/dev/null && docker compose stop updater >/dev/null 2>&1 && docker compose down -v --remove-orphans >/dev/null 2>&1) || true
  rm -rf "$WORK"
}
trap cleanup EXIT

commit_and_push() {
  # commit_and_push <message>: the "Mac" pushes to "GitHub"
  git -C "$DEV" add -A
  git -C "$DEV" -c user.name=e2e -c user.email=e2e@test commit -qm "$1"
  git -C "$DEV" push -q origin "HEAD:$BRANCH"
}
short() { git -C "$1" rev-parse --short=7 HEAD; }
api_version() { curl -s --max-time 5 "$URL/health" | jq -r '.api.version // ""' 2>/dev/null || echo ""; }
version_ends() { case "$(api_version)" in *"$1") return 0 ;; *) return 1 ;; esac; }
page_says() { [ "$(curl -s --max-time 5 "$URL/e2e.txt")" = "$1" ]; }
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
status_is() { [ "$(jq -r .result "$PROD/deploy/state/status.json" 2>/dev/null)" = "$1" ]; }

step "Setting up in $WORK"
# "GitHub": the repo as it is now (working tree included), pushed to a bare origin.
git clone -q --no-hardlinks "$ROOT" "$DEV"
rsync -a --delete --exclude .git --exclude node_modules --exclude dist --exclude build --exclude .gradle --exclude graphify-out \
  --exclude 'deploy/.env' --exclude 'deploy/backups' --exclude 'deploy/state' "$ROOT/" "$DEV/"
echo v1 >"$DEV/frontend/public/e2e.txt"
git -C "$DEV" add -A && git -C "$DEV" -c user.name=e2e -c user.email=e2e@test commit -q -m "e2e: the working tree" || true
git clone -q --no-hardlinks "$DEV" "$PROD"
git clone -q --bare "$DEV" "$ORIGIN"
git -C "$PROD" remote set-url origin "$ORIGIN"
git -C "$DEV" remote set-url origin "$ORIGIN"
git -C "$PROD" fetch -q origin && git -C "$PROD" branch -q -u origin/"$(git -C "$PROD" rev-parse --abbrev-ref HEAD)" 2>/dev/null || true
BRANCH="$(git -C "$PROD" rev-parse --abbrev-ref HEAD)"
cat >"$PROD/deploy/.env" <<ENV
COMPOSE_PROJECT_NAME=$PROJECT
COMPOSE_FILE=docker-compose.yml:test/docker-compose.e2e.yml
LMS_HOST_DIR=$PROD
LMS_UID=$(id -u)
LMS_GID=$(id -g)
DOCKER_GID=0
LMS_BRANCH=$BRANCH
CHECK_EVERY=3
HEALTH_TIMEOUT=90
TZ=Europe/Chisinau
POSTGRES_PASSWORD=$(openssl rand -hex 16)
APP_URL=https://lms.e2e.test
JWT_SECRET=$(openssl rand -hex 32)
TUNNEL_TOKEN=unused-in-the-test
ADMIN_EMAIL=admin@e2e.test
ADMIN_PASSWORD=e2e-password-123456
ADMIN_NAME=E2E
ADMIN_SURNAME=Test
ENV
mkdir -p "$PROD/deploy/state" "$PROD/deploy/backups"
ok "origin and the PC's checkout ready (branch $BRANCH)"

step "1. First start: built here"
(cd "$PROD/deploy" && docker compose up -d --build --quiet-pull postgres backup updater >/dev/null 2>&1) || die "compose up failed"
(cd "$PROD/deploy" && docker compose exec -T updater lms-update --release) || die "the first release failed"
version_ends "$(short "$PROD")" && ok "the API runs $(api_version)" || die "version $(api_version)"
curl -s "$URL/" | grep -q '<title>LMS</title>' && ok "the web app is served by the same container" || die "no web app at /"
page_says v1 && ok "its files too" || die "e2e.txt: $(curl -s "$URL/e2e.txt")"
(cd "$PROD/deploy" && docker compose ps --services --status running) | sort | tr '\n' ' ' | grep -q 'api backup postgres updater' && ok "postgres, app, updater, backup running (no tunnel in the test)" || die "services: $(cd "$PROD/deploy" && docker compose ps --services --status running | tr '\n' ' ')"
[ "$(stat -c %u "$PROD/deploy/state/live" 2>/dev/null || stat -f %u "$PROD/deploy/state/live")" = "$(id -u)" ] && ok "the updater's files are the checkout owner's" || die "state/live isn't owned by $(id -u)"

step "2. A commit pushed"
echo v2 >"$DEV/frontend/public/e2e.txt"
commit_and_push "e2e: v2"
wait_for 300 "v2 live" page_says v2
wait_for 120 "the release finished" status_is ok
version_ends "$(short "$DEV")" && ok "pulled, rebuilt and live: $(api_version)" || die "version $(api_version)"
ls "$PROD/deploy/backups"/pre-update-*.dump >/dev/null 2>&1 && ok "a backup was taken first" || die "no pre-update backup"

step "3. A broken commit"
good="$(api_version)"
printf 'throw new Error("broken on purpose");\n' >"$DEV/backend/src/broken.ts"
printf "import './broken';\n" | cat - "$DEV/backend/src/server.ts" >"$DEV/server.tmp" && mv "$DEV/server.tmp" "$DEV/backend/src/server.ts"
commit_and_push "e2e: broken"
wait_for 300 "rolled back" status_is rolled-back
[ "$(api_version)" = "$good" ] && ok "it wasn't healthy: back on $good by itself" || die "version $(api_version)"
sleep 10
[ "$(api_version)" = "$good" ] && status_is rolled-back && ok "not retried a few rounds later" || die "status $(jq -r .result "$PROD/deploy/state/status.json")"

step "4. The fix"
git -C "$DEV" -c user.name=e2e -c user.email=e2e@test revert --no-edit HEAD >/dev/null
echo v4 >"$DEV/frontend/public/e2e.txt"
commit_and_push "e2e: v4"
wait_for 300 "v4 live" page_says v4
wait_for 120 "the release finished" status_is ok
[ ! -e "$PROD/deploy/state/bad" ] && ok "live, and the bad mark is gone" || die "status $(jq -r .result "$PROD/deploy/state/status.json")"

step "5. An edit made on the PC"
echo local >"$PROD/frontend/public/e2e.txt"
echo "# pushed meanwhile" >>"$DEV/README.md"
commit_and_push "e2e: pushed while the PC has local changes"
before="$(git -C "$PROD" rev-parse HEAD)"
sleep 10
[ "$(git -C "$PROD" rev-parse HEAD)" = "$before" ] && page_says v4 && ok "the updater leaves local changes alone (no pull, no release)" || die "it pulled or released over local changes"
(cd "$PROD" && deploy/server/live.sh --no-checks >/dev/null) || die "live.sh failed"
page_says local && version_ends -local && ok "live.sh put the edit live: $(api_version)" || die "e2e.txt $(curl -s "$URL/e2e.txt"), version $(api_version)"
[ -n "$(git -C "$PROD" status --porcelain)" ] && ok "the edit is still there to commit" || die "the edit is gone"

step "6. Backup and restore"
file="$(cd "$PROD" && deploy/server/backup-now.sh | awk '{print $1}')"
[ -s "$PROD/deploy/$file" ] && ok "backup-now: $file" || die "backup-now made nothing"
users_before="$(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -tAc 'select count(*) from users')"
(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -qc "insert into households (id, name) values (gen_random_uuid(), 'after the backup')")
(cd "$PROD" && echo yes | deploy/server/restore.sh "deploy/$file" >/dev/null 2>&1) || die "restore failed"
gone="$(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -tAc "select count(*) from households where name = 'after the backup'")"
users_after="$(cd "$PROD/deploy" && docker compose exec -T postgres psql -U lms -d lms -tAc 'select count(*) from users')"
[ "$gone" = 0 ] && [ "$users_before" = "$users_after" ] && ok "restored: the later row is gone, the $users_after user(s) kept" || die "restore: later rows $gone, users $users_before→$users_after"
wait_for 60 "the app back after the restore" page_says local
ok "the app is back"

printf '\n\033[32m%d checks passed\033[0m\n' "$PASSED"
