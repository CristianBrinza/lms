#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time setup of the LMS server (the always-on Windows PC, inside WSL Ubuntu; or any Linux box
# with Docker). Run from the repo:  deploy/server/setup.sh
#
#   - checks Docker, Compose and git
#   - writes deploy/.env: generates the database password, the JWT secret and the push (VAPID)
#     keys, and asks for the rest (the app's address, the tunnel token, the first admin)
#   - builds the app from this checkout and starts everything; from then on the updater keeps it
#     up to date, and deploy/server/live.sh puts changes made here live
#
# Safe to run again: an existing deploy/.env is kept (only missing values are added).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
DEPLOY="$(pwd)"
ENV="$DEPLOY/.env"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

say "Checking the machine"
command -v docker >/dev/null || fail "Docker isn't installed (Docker Desktop with WSL integration, or Docker Engine)."
docker info >/dev/null 2>&1 || fail "Docker isn't running (start Docker Desktop)."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is missing."
command -v git >/dev/null || fail "git isn't installed (sudo apt install git)."
git -C "$DEPLOY" rev-parse --git-dir >/dev/null 2>&1 || fail "Run this from a git clone of the LMS repository."
echo "Docker $(docker version --format '{{.Server.Version}}'), $(docker compose version --short), git $(git --version | cut -d' ' -f3)"
case "$DEPLOY" in
  /mnt/*) echo "Note: the repo is on a Windows drive ($DEPLOY). It works, but cloning it inside WSL (~/lms) is faster and safer." ;;
esac

touch "$ENV"
chmod 600 "$ENV"
get() { grep -E "^$1=" "$ENV" | tail -n1 | cut -d= -f2- || true; }
set_value() {
  # Adds KEY=value when KEY is missing or empty; never overwrites a value already there.
  local key="$1" value="$2"
  if grep -qE "^$key=.+" "$ENV"; then return 0; fi
  if grep -qE "^$key=" "$ENV"; then sed -i "s|^$key=.*|$key=$value|" "$ENV"; else echo "$key=$value" >>"$ENV"; fi
}
ask() {
  # ask KEY "question" [default] — only when KEY has no value yet.
  local key="$1" question="$2" default="${3:-}" answer
  if [ -n "$(get "$key")" ]; then return 0; fi
  read -r -p "$question${default:+ [$default]}: " answer
  set_value "$key" "${answer:-$default}"
}
secret() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48; }

say "Settings (deploy/.env)"
set_value LMS_HOST_DIR "$(cd "$DEPLOY/.." && pwd)"
set_value LMS_BRANCH main
set_value LMS_UID "$(id -u)"
set_value LMS_GID "$(id -g)"
set_value DOCKER_GID "$(stat -c %g /var/run/docker.sock)"
set_value TZ Europe/Chisinau
set_value POSTGRES_PASSWORD "$(secret)"
set_value JWT_SECRET "$(secret)"
ask APP_URL "The app's public address" "https://lms.shades.md"
ask TUNNEL_TOKEN "Cloudflare Tunnel token (Zero Trust → Networks → Tunnels → your tunnel)"
ask ADMIN_EMAIL "First admin's email"
ask ADMIN_NAME "First admin's name"
ask ADMIN_SURNAME "First admin's surname"
if [ -z "$(get ADMIN_PASSWORD)" ] && ! docker compose ps -q postgres 2>/dev/null | grep -q .; then
  read -r -s -p "First admin's password (12+ characters; remove it from deploy/.env after the first start): " password
  echo
  set_value ADMIN_PASSWORD "$password"
fi
if [ -z "$(get VAPID_PUBLIC_KEY)" ]; then
  echo "Generating the push (VAPID) keys…"
  keys="$(docker run --rm node:22-alpine npx -y web-push generate-vapid-keys --json)"
  set_value VAPID_PUBLIC_KEY "$(echo "$keys" | sed -E 's/.*"publicKey":"([^"]+)".*/\1/')"
  set_value VAPID_PRIVATE_KEY "$(echo "$keys" | sed -E 's/.*"privateKey":"([^"]+)".*/\1/')"
  set_value VAPID_SUBJECT "mailto:$(get ADMIN_EMAIL)"
fi
echo "deploy/.env is ready (readable by you only)."

say "Building and starting (the first build takes a few minutes)"
mkdir -p "$DEPLOY/state" "$DEPLOY/backups" # yours, before Docker would make them root's
docker compose up -d --build postgres backup updater
docker compose exec -T updater lms-update --release || fail "The first release failed: see above and deploy/state/build.log."
"$DEPLOY/server/status.sh"

cat <<'EOF'

Next:
  • Cloudflare: the tunnel's public hostname lms.shades.md → service HTTP, api:8790
    (docs/production.md).
  • Remove ADMIN_PASSWORD from deploy/.env once you have signed in.
  • Windows: keep the PC awake and Docker starting at sign-in (deploy/windows/keep-awake.ps1).
EOF
