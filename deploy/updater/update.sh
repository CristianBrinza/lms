#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# The LMS updater. Every CHECK_EVERY seconds:
#
#   1. git: fast-forward this checkout to origin/$LMS_BRANCH (the deploy files: compose, scripts)
#   2. image: pull the API image (only images that passed CI are ever published)
#   3. something new → back the database up, remember the running image, `compose up`,
#      wait for the API's health check; unhealthy → put the previous image back and skip the
#      bad one until a newer one comes.
#
# It never touches deploy/.env or the database's volume. Its state (what runs, the last result)
# is in deploy/state/status.json; its log is `docker compose logs updater`.
#
#   lms-update            the loop (the container's command)
#   lms-update --once     one round (tests, or by hand: docker compose run --rm updater --once)
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BRANCH="${LMS_BRANCH:-main}"
EVERY="${CHECK_EVERY:-60}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
DEPLOY_DIR="$(pwd)"
STATE_DIR="$DEPLOY_DIR/state"
BACKUP_DIR="$DEPLOY_DIR/backups"
mkdir -p "$STATE_DIR" "$BACKUP_DIR"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
compose() { docker compose "$@"; }
# What the api service runs: LMS_IMAGE:LMS_TAG from deploy/.env (compose resolves the default).
image_ref() { compose config --format json 2>/dev/null | jq -r '.services.api.image // empty'; }
# Tags only ever go onto the API's own image: never onto postgres, cloudflared or anything else.
tag_api() {
  local source="$1" ref
  ref="$(image_ref)"
  if [ -z "$ref" ] || compose config --format json 2>/dev/null | jq -e --arg ref "$ref" '[.services | to_entries[] | select(.key != "api") | .value.image] | index($ref)' >/dev/null; then
    log "refusing to tag '$ref': not the API's own image"
    return 1
  fi
  docker tag "$source" "$ref"
}
image_id() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true; }
running_id() {
  local container
  container="$(compose ps -q api 2>/dev/null)"
  [ -n "$container" ] && docker inspect --format '{{.Image}}' "$container" 2>/dev/null || true
}

write_status() {
  # $1 result, $2 message
  local ref commit
  ref="$(image_ref)"
  commit="$(git -C "$DEPLOY_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
  jq -n --arg result "$1" --arg message "$2" --arg image "$ref" --arg imageId "$(running_id)" --arg commit "$commit" \
    --arg at "$(date -Iseconds)" --arg version "$(api_version)" \
    '{result: $result, message: $message, image: $image, imageId: $imageId, version: $version, commit: $commit, at: $at}' \
    >"$STATE_DIR/status.json.tmp" && mv "$STATE_DIR/status.json.tmp" "$STATE_DIR/status.json"
}

api_version() {
  local container
  container="$(compose ps -q api 2>/dev/null)"
  [ -z "$container" ] && return 0
  # The health route sits behind the proxy key; ask from inside the API's own container.
  docker exec "$container" node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{headers:{'x-lms-proxy-key':process.env.PROXY_SECRET||''}}).then(r=>r.json()).then(b=>console.log(b.version||'')).catch(()=>console.log(''))" 2>/dev/null || true
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
  log "backup FAILED: not updating without one"
  return 1
}

# The services this updater runs: the active ones (profiles respected), but not itself —
# recreating its own container would stop this script.
services() { compose config --services 2>/dev/null | grep -vx updater; }

round() {
  local changed_files="" before_commit after_commit ref before_id after_id bad
  # 1. The deploy files.
  before_commit="$(git rev-parse HEAD 2>/dev/null || true)"
  if git fetch --quiet origin "$BRANCH" 2>/dev/null; then
    after_commit="$(git rev-parse "origin/$BRANCH")"
    if [ "$before_commit" != "$after_commit" ]; then
      if git merge --ff-only --quiet "origin/$BRANCH" 2>/dev/null; then
        changed_files="$(git diff --name-only "$before_commit" "$after_commit" -- deploy | tr '\n' ' ')"
        log "git: $(git log -1 --format='%h %s')"
      else
        log "git: can't fast-forward to origin/$BRANCH (local changes?); staying on $(git rev-parse --short HEAD)"
      fi
    fi
  else
    log "git: fetch failed (offline?)"
  fi

  # 2. The API image. (What runs healthy is also lms-api:current: once the tag moves to a new image,
  # the old one can't be found by its id any more, and a rollback needs it.)
  ref="$(image_ref)"
  before_id="$(running_id)"
  if ! compose pull --quiet api 2>/dev/null; then log "image: pull failed for $ref"; fi
  after_id="$(image_id "$ref")"
  bad="$(cat "$STATE_DIR/bad-image" 2>/dev/null || true)"
  if [ -n "$after_id" ] && [ "$after_id" = "$bad" ] && [ -n "$before_id" ]; then
    # Known bad: the tag goes straight back to the good one, so a restart (or a reboot) runs that.
    tag_api lms-api:current
    after_id="$before_id"
  fi

  if [ "$after_id" = "$before_id" ] && [ -z "$changed_files" ]; then
    return 0
  fi

  # 3. Something new.
  log "update: image ${before_id:0:19} → ${after_id:0:19}${changed_files:+, files: $changed_files}"
  if [ -n "$before_id" ]; then
    backup || { write_status failed "backup failed"; return 1; }
  fi
  # shellcheck disable=SC2046
  compose up -d --remove-orphans $(services)
  if wait_healthy; then
    docker tag "$ref" lms-api:current
    rm -f "$STATE_DIR/bad-image"
    log "update: healthy, version $(api_version)"
    write_status ok "updated"
  else
    log "update: NOT healthy — rolling back"
    [ -n "$after_id" ] && echo "$after_id" >"$STATE_DIR/bad-image"
    if [ -n "$before_id" ]; then
      tag_api lms-api:current
      compose up -d api
      if wait_healthy; then
        log "rollback: healthy again, version $(api_version)"
        write_status rolled-back "the new API wasn't healthy; back on the previous one"
      else
        log "rollback: still not healthy"
        write_status failed "neither the new nor the previous API is healthy"
      fi
    else
      write_status failed "the API isn't healthy"
    fi
  fi

  # The updater's own files changed: rebuild it last (this script stops with its container).
  if [[ " $changed_files " == *" deploy/updater/"* ]]; then
    log "updater: new version of myself, restarting"
    compose up -d --build --no-deps updater
  fi
}

cd "$DEPLOY_DIR" || exit 1
if [ "${1:-}" = "--once" ]; then
  round
  exit $?
fi
log "watching origin/$BRANCH and $(image_ref) every ${EVERY}s"
# First round: make sure everything runs (a reboot, a first start), and name what runs healthy.
# shellcheck disable=SC2046
compose up -d $(services) >/dev/null 2>&1 || true
if wait_healthy && [ "$(running_id)" = "$(image_id "$(image_ref)")" ]; then
  docker tag "$(image_ref)" lms-api:current
  write_status ok "running"
fi
while true; do
  round || true
  sleep "$EVERY"
done
