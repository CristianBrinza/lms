#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# The LMS updater: builds the app from this checkout and puts it live, safely.
#
#   lms-update              the loop (the container's command). Every CHECK_EVERY seconds:
#                           a checkout without local changes fast-forwards to origin/$LMS_BRANCH;
#                           a commit that isn't live yet is released.
#   lms-update --release    release this checkout now, local changes included (deploy/server/live.sh)
#   lms-update --once       one round of the loop (tests)
#
# A release: build the image (web app + API) → back the database up → switch → wait for the
# health check → healthy: done; unhealthy: the previous image goes back, and the loop leaves that
# commit alone until a newer one comes.
#
# It never touches deploy/.env or the database's volume. Its state (what runs, the last result)
# is in deploy/state/; its log is `docker compose logs updater`.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BRANCH="${LMS_BRANCH:-main}"
EVERY="${CHECK_EVERY:-60}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
DEPLOY_DIR="$(pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
STATE_DIR="$DEPLOY_DIR/state"
BACKUP_DIR="$DEPLOY_DIR/backups"
LIVE=lms-app:live
mkdir -p "$STATE_DIR" "$BACKUP_DIR"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
compose() { docker compose "$@"; }
image_id() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true; }
# Local changes, new files included (state, backups and .env are git-ignored).
dirty() { [ -n "$(git -C "$REPO_DIR" status --porcelain)" ]; }
head_commit() { git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null; }
# What a release of the checkout as it is would be called: the commit, plus "+local" with edits.
label() { if dirty; then echo "$(head_commit)+local"; else head_commit; fi; }

api_version() {
  local container
  container="$(compose ps -q api 2>/dev/null)"
  [ -z "$container" ] && return 0
  docker exec "$container" node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>r.json()).then(b=>console.log(b.version||'')).catch(()=>console.log(''))" 2>/dev/null || true
}

write_status() {
  # $1 result, $2 message
  jq -n --arg result "$1" --arg message "$2" --arg live "$(cat "$STATE_DIR/live" 2>/dev/null)" \
    --arg version "$(api_version)" --arg at "$(date -Iseconds)" \
    '{result: $result, message: $message, live: $live, version: $version, at: $at}' \
    >"$STATE_DIR/status.json.tmp" && mv "$STATE_DIR/status.json.tmp" "$STATE_DIR/status.json"
}

wait_healthy() {
  local container status restarts start="" waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    container="$(compose ps -q api 2>/dev/null)"
    if [ -n "$container" ]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null)"
      case "$status" in
        healthy) return 0 ;;
        exited | dead) return 1 ;;
      esac
      # A container that keeps restarting (a crash on start) never gets healthy: 3 new restarts and it's out.
      restarts="$(docker inspect --format '{{.RestartCount}}' "$container" 2>/dev/null || echo 0)"
      [ -z "$start" ] && start="$restarts"
      if [ $((restarts - start)) -ge 3 ]; then return 1; fi
    fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

backup() {
  local file
  file="$BACKUP_DIR/pre-update-$(date '+%Y%m%d-%H%M%S').dump"
  if compose exec -T postgres pg_dump -U lms -d lms -Fc >"$file" 2>/dev/null && [ -s "$file" ]; then
    log "backup: $(basename "$file") ($(du -h "$file" | cut -f1))"
    return 0
  fi
  rm -f "$file"
  log "backup FAILED: not switching without one"
  return 1
}

# The services this updater runs: the active ones, but not itself (recreating its own container
# would stop this script).
services() { compose config --services 2>/dev/null | grep -vx updater; }

release() {
  local what version previous_files
  what="$(label)"
  version="$(date -u +%Y%m%d%H%M)-$(git -C "$REPO_DIR" rev-parse --short HEAD)$(dirty && echo '-local')"
  log "release: $what (version $version)"
  write_status building "building $version"

  build() { docker build --progress=plain --build-arg APP_VERSION="$version" -t lms-app:candidate "$REPO_DIR" >"$STATE_DIR/build.log" 2>&1; }
  # A second try: a download that broke halfway (the network, the registry) is the usual failure.
  if ! build && ! { log "release: the build failed, trying once more"; sleep 10; build; }; then
    log "release: the build FAILED; the end of deploy/state/build.log:"
    tail -n 30 "$STATE_DIR/build.log" | sed 's/^/    /'
    echo "$what" >"$STATE_DIR/bad"
    write_status failed "the build failed: nothing changed"
    return 1
  fi

  previous_files="$(cat "$STATE_DIR/live-files" 2>/dev/null || true)"
  if [ -n "$(image_id "$LIVE")" ]; then
    backup || { write_status failed "backup failed: nothing changed"; return 1; }
    docker tag "$LIVE" lms-app:previous
  fi
  docker tag lms-app:candidate "$LIVE"
  # shellcheck disable=SC2046
  compose up -d --remove-orphans $(services)

  if wait_healthy; then
    echo "$what" >"$STATE_DIR/live"
    git -C "$REPO_DIR" rev-parse HEAD:deploy/updater >"$STATE_DIR/live-files" 2>/dev/null || true
    rm -f "$STATE_DIR/bad"
    log "release: live and healthy, version $(api_version)"
    write_status ok "live"
  else
    log "release: NOT healthy — rolling back"
    echo "$what" >"$STATE_DIR/bad"
    if [ -n "$(image_id lms-app:previous)" ]; then
      docker tag lms-app:previous "$LIVE"
      compose up -d api
      if wait_healthy; then
        log "rollback: healthy again, version $(api_version)"
        write_status rolled-back "the new version wasn't healthy; back on the previous one"
      else
        log "rollback: still not healthy"
        write_status failed "neither the new nor the previous version is healthy"
      fi
    else
      write_status failed "the app isn't healthy"
    fi
    return 1
  fi

  # The updater's own files changed: rebuild it last (this script stops with its container).
  if [ -n "$previous_files" ] && [ "$previous_files" != "$(cat "$STATE_DIR/live-files" 2>/dev/null)" ]; then
    log "updater: new version of myself, restarting"
    compose up -d --build --no-deps updater
  fi
}

round() {
  if dirty; then
    # Someone is working on this machine: their edits are put live with deploy/server/live.sh,
    # and nothing from GitHub is merged over them.
    [ -f "$STATE_DIR/said-dirty" ] || log "git: local changes here; not pulling (deploy/server/live.sh puts them live)"
    touch "$STATE_DIR/said-dirty"
    return 0
  fi
  rm -f "$STATE_DIR/said-dirty"

  if git -C "$REPO_DIR" fetch --quiet origin "$BRANCH" 2>/dev/null; then
    if [ "$(head_commit)" != "$(git -C "$REPO_DIR" rev-parse "origin/$BRANCH")" ]; then
      if git -C "$REPO_DIR" merge --ff-only --quiet "origin/$BRANCH" 2>/dev/null; then
        log "git: $(git -C "$REPO_DIR" log -1 --format='%h %s')"
      elif ! git -C "$REPO_DIR" merge-base --is-ancestor "origin/$BRANCH" HEAD; then
        log "git: this checkout and origin/$BRANCH have both moved on; pull and push here to join them"
      fi
    fi
  fi

  local what
  what="$(label)"
  [ "$what" = "$(cat "$STATE_DIR/live" 2>/dev/null)" ] && return 0
  [ "$what" = "$(cat "$STATE_DIR/bad" 2>/dev/null)" ] && return 0
  release
}

cd "$DEPLOY_DIR" || exit 1
# One release at a time (the loop, live.sh): a lock in the container itself; flock on a bind
# mount isn't reliable everywhere.
exec 9>/tmp/lms-release.lock
case "${1:-}" in
  --release)
    flock 9
    release
    exit $?
    ;;
  --once)
    flock 9
    round
    exit $?
    ;;
esac

log "watching origin/$BRANCH every ${EVERY}s"
# First round: make sure everything runs (a reboot, a first start).
if [ -n "$(image_id "$LIVE")" ]; then
  # shellcheck disable=SC2046
  compose up -d $(services) >/dev/null 2>&1 || true
fi
while true; do
  flock 9
  round || true
  flock -u 9
  sleep "$EVERY"
done
