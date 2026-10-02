# LMS in production

How LMS runs for real: where each piece lives, how a change reaches it, how Claude works on its
data, and what to do when something is off.

```
 This Mac / a Claude cloud session                 GitHub
 ┌──────────────────────────────┐   git push   ┌───────────────────────────────────────────┐
 │ code changes, commits        │ ───────────▶ │ Actions: checks → API image (ghcr.io)      │
 │ Claude edits production data │              │          → waits for the API → web app ───┼──┐
 │   through the public app     │              └───────────────────────────────────────────┘  │
 └──────────────┬───────────────┘                         │ image                            │ wrangler
                │ https (access key)                      ▼                                  ▼
                │                ┌──────────────────────────────────────┐   ┌───────────────────────────┐
                └──────────────▶ │ Cloudflare: lms.shades.md (Worker)    │◀──│ browsers, the phone app   │
                                 │  - the web app                        │   └───────────────────────────┘
                                 │  - /api → tunnel, with two keys       │
                                 └──────────────────┬───────────────────┘
                                   Access + tunnel  │ (outbound from the PC; no open ports)
                                 ┌──────────────────▼───────────────────────────────────────────┐
                                 │ Windows PC, always on — WSL Ubuntu + Docker Desktop           │
                                 │   cloudflared · API · PostgreSQL · updater · nightly backups  │
                                 │   updater: every minute git pull + image pull → backup →      │
                                 │            switch → health check → roll back if unhealthy     │
                                 └──────────────────────────────────────────────────────────────┘
```

## The flow of a change

1. A change is made here (or in a cloud session), committed and pushed. Work happens on a branch
   and goes into `main` when it's ready; `main` is production.
2. GitHub Actions (`.github/workflows/ci.yml`) runs every check on every push: typecheck, lint, the
   tests against a real PostgreSQL, the production builds. Red stops everything.
3. On `main`, green: CI builds the API image and publishes `ghcr.io/cristianbrinza/lms-api:main`
   (and `:sha-<commit>`).
4. On the PC, the updater sees it within a minute: it backs the database up, switches to the new
   image, and waits for the API's health check. Unhealthy → it puts the previous image back by
   itself and skips that one until a newer image comes. Database migrations run on the API's start.
5. CI waits until the live API reports the new version, then publishes the web app to Cloudflare
   and runs the live checks. The web app never goes out ahead of the API it needs. If the PC is off,
   this step fails after 15 minutes and the web app stays as it was (safe); re-run the job later.

Changes to the deploy files themselves (compose, scripts) reach the PC the same way: the updater
fast-forwards its checkout to `origin/main` and applies them.

## Security: what keeps the server hidden

- **No open ports, no public IP.** cloudflared on the PC dials out to Cloudflare; nothing listens
  on the internet. The PC's address is never known to anyone.
- **The API's hostname answers only the Worker.** Two locks:
  1. **Cloudflare Access** in front of the tunnel hostname, with a policy that admits only a
     _service token_ the Worker holds. Everyone else is stopped at Cloudflare's edge and never
     reaches the PC.
  2. **PROXY_SECRET**: the API itself answers a bare 404 to anything without the Worker's key.
- **People and Claude only ever use the app's address** (lms.shades.md): first-party cookies, no
  CORS, the API's address never appears in the app.
- **Access keys** (Settings → Claude access) are scoped (read only / kitchen / everything), stored
  hashed, shown once, revocable. Sign-in is rate limited.
- **Secrets live in three places only:** `deploy/.env` on the PC (readable by its user only),
  the Worker's secrets in Cloudflare, and GitHub's encrypted secrets for CI. None are in the repo.
- **Backups** stay on the PC (`deploy/backups`). Copy them off the machine now and then (see
  below).
- **The updater** controls Docker through its socket: that is root on the PC's Docker. It has no
  network listener, runs only this repo's script, and only images that passed CI are published.

**The repository is public today.** That's fine for the code (no secrets in it), but it shows the
whole app and its infrastructure to anyone. Make it private (GitHub → Settings → General → Danger
Zone → Change visibility); then also keep the image private (it is by default for a private repo)
and give the PC a token to pull it (setup.sh asks). Private repos get 2,000 free Actions minutes a
month, far more than this needs.

## One-time setup

### GitHub

1. **Visibility**: make the repo private (above).
2. **Protect `main`**: Settings → Branches → add a rule for `main`: require the "Checks" status to
   pass. Then nothing broken can reach production, even by a direct push.
3. **Settings → Environments → New: `production`**, then in it:
   - Variables: `APP_URL` = `https://lms.shades.md`, `API_ORIGIN` = the tunnel hostname
     (e.g. `https://lms-api.shades.md`)
   - Secrets: `CLOUDFLARE_API_TOKEN` (My Profile → API Tokens → "Edit Cloudflare Workers"),
     `CLOUDFLARE_ACCOUNT_ID`
4. Push `main` once: CI publishes the first image; the "Web app" job waits for the PC.

### Cloudflare

1. **Tunnel**: Zero Trust → Networks → Tunnels → Create a tunnel (Cloudflared) → copy its token (for
   the PC's `deploy/.env`). Public hostname: `lms-api.shades.md` → Service `HTTP`, `api:8790`.
2. **Hide the API**:
   - Zero Trust → Access → Service credentials → Service tokens → Create `lms-worker`. Copy the
     Client ID and Secret into `.env.deploy` here (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`).
   - Access → Applications → Add → Self-hosted, domain `lms-api.shades.md`. Policy: Action
     **Service Auth**, Include **Service Token** `lms-worker`. No other policies.
3. **The Worker's keys**: here, `yarn deploy secrets` (PROXY_SECRET from the PC's `deploy/.env`,
   copied here once, and the Access token).
4. **Check**: `yarn deploy:verify` → "Cloudflare Access stops it at the edge".

### The Windows PC

1. **WSL and Docker**: in PowerShell as Administrator `wsl --install -d Ubuntu`, restart. Install
   Docker Desktop: Settings → General → "Use the WSL 2 based engine", Resources → WSL integration →
   Ubuntu on.
2. **Keep it running**: `powershell -ExecutionPolicy Bypass -File deploy\windows\keep-awake.ps1`
   (no sleep on mains power; Docker Desktop starts at sign-in), and turn on automatic sign-in
   (`netplwiz`) so a Windows Update restart brings everything back unattended.
3. **The repo, inside WSL** (Ubuntu terminal): `sudo apt install -y git`, then
   `git clone https://github.com/CristianBrinza/lms.git ~/lms` (a private repo: a GitHub token, or
   `gh auth login`). Inside WSL, not on `C:`: faster, and no Windows line endings.
4. **Setup**: `cd ~/lms && deploy/server/setup.sh`. It checks Docker, writes `deploy/.env`
   (generating the database password, the JWT and proxy secrets and the push keys; asking for the
   address, the tunnel token and the first admin), signs in to ghcr.io if needed, and starts
   everything. From then on the updater keeps it current.
5. **Check**: `deploy/server/status.sh`.

## Claude on production

Claude changes production _data_ (food, recipes, the plan, lists, kitchenware) through the app's
public address with an access key; it never touches the PC or the database directly. The project
skill `.claude/skills/lms-production` tells it how.

- **A key**: in the app, Settings → Claude access → new key, scope "Kitchen".
- **MCP (best)**: `claude mcp add --transport http --scope user lms https://lms.shades.md/api/mcp --header "Authorization: Bearer <key>"`
  — once per machine; the key stays in Claude's own settings, outside the repo.
- **Or the CLI**: `node scripts/lms.mjs login` (the key is asked for, hidden, and kept in
  `~/.config/lms/production.env`, readable by you only). Then `node scripts/lms.mjs whoami`,
  `node scripts/lms.mjs GET /api/food/overview`, …
- **Cloud sessions**: set `LMS_KEY` (and `LMS_URL` if not production) in the environment's settings.

## Two Claudes: development and the server

The Windows PC runs its own Claude (the desktop app, with Claude Code inside WSL in `~/lms`), with
Remote Control on, named **"LMS production server"**. This Mac's session is **"LMS development"**.

- From a browser here, Cristian opens either session and talks to it.
- The development session messages the server's session: "is abc1234 live?", "send me the API
  log", and gets the answer back. The server's Claude never edits code (the updater needs a clean
  checkout); it reports what a fix needs, and the fix is pushed from development.
- Roles and rules: `CLAUDE.md` at the repo root (which machine am I on?) and the skills
  `.claude/skills/lms-server` (the server) and `.claude/skills/lms-production` (production data).

## Day to day

| What                                   | How                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| What runs, which version, last backups | `deploy/server/status.sh` (on the PC) · `node scripts/lms.mjs health` (anywhere)                |
| The updater's log                      | `docker compose logs -f updater` (in `~/lms/deploy`)                                            |
| A backup now                           | `deploy/server/backup-now.sh`                                                                   |
| Restore                                | `deploy/server/restore.sh deploy/backups/<file>.dump` (saves the current data first)            |
| Hold a version                         | `LMS_TAG=sha-<commit>` in `deploy/.env`, then `docker compose up -d api`                        |
| Back to following `main`               | remove `LMS_TAG`, `docker compose up -d api`                                                    |
| Copy backups off the PC                | e.g. a OneDrive folder: `cp deploy/backups/lms-*.dump /mnt/c/Users/<you>/OneDrive/lms-backups/` |
| Rotate PROXY_SECRET                    | change it in `deploy/.env`, `docker compose up -d api`, then here `yarn deploy secrets`         |

**The app says "temporarily unavailable"**: the API isn't reachable. In order: is the PC on and
signed in? Docker Desktop running? `deploy/server/status.sh`. The tunnel container's log
(`docker compose logs tunnel`) shows Cloudflare connection problems.

## Testing the pipeline

`deploy/test/e2e.sh` runs the whole thing on this Mac's Docker, with a local registry standing in
for ghcr.io and a bare git repo for GitHub: first start, an update with its backup, an automatic
rollback from a broken version (also across a restart), a deploy-file change over git, the next
good version, a backup and a restore. It uses its own project name and ports, so a dev database
next to it is untouched. `KEEP=1` leaves it running to look at.
