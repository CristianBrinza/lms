# LMS in production

How LMS runs for real: where each piece lives, how a change reaches it, how Claude works on it, and
what to do when something is off.

```
 This Mac / a Claude cloud session          GitHub (main)
 ┌─────────────────────────────┐  git push  ┌────────────────────────────┐
 │ code changes, commits       │ ─────────▶ │ Actions: checks only       │
 └─────────────────────────────┘            └──────────────┬─────────────┘
                                                           │ git pull, every minute
 browsers, the phone apps                                  │ (when the PC has no local changes)
          │ https://lms.shades.md                          ▼
          ▼                              ┌──────────────────────────────────────────────────────┐
 ┌──────────────────────┐   tunnel       │ Windows PC, always on — WSL Ubuntu + Docker Desktop  │
 │ Cloudflare           │ ◀───────────── │  ~/lms: the checkout (Claude can work here too)      │
 │ lms.shades.md        │  (outbound     │  cloudflared → app (web app + API) → PostgreSQL      │
 └──────────────────────┘   from the PC) │  updater: build → backup → switch → health check →   │
                                         │           roll back if unhealthy                     │
                                         │  live.sh: the same, for a change made right here     │
                                         │  nightly backups                                      │
                                         └──────────────────────────────────────────────────────┘
```

Everything runs on the PC: the web app and the API are one container (the API serves the built web
app), next to PostgreSQL. Cloudflare only carries the traffic: the tunnel's public hostname,
lms.shades.md, points at that container.

## How a change goes live

The PC builds the app from its own checkout (`~/lms`, the root `Dockerfile`). Nothing is pulled
from a registry. There are two ways in, and both end in the same release:

**A release** (`deploy/updater/update.sh`): build the image (web app + API; the web app's
TypeScript is checked here) → back the database up → switch → wait for the health check (`/health`:
the web build and the API with its database) → healthy: done. Unhealthy: the previous version goes
back by itself, and that commit is left alone until a newer one comes. Database migrations run on
the app's start. A build that fails changes nothing.

1. **Made on the PC** (Claude on the PC, or by hand): edit, then `deploy/server/live.sh`. It runs
   `yarn verify` (when Node is installed there), then a release of the checkout as it is, local
   edits included. Live for everyone in a couple of minutes. Then commit and push.
2. **Pushed from elsewhere** (the Mac, a cloud session): to `main`. The PC's updater checks every
   minute; when its checkout has no local changes, it fast-forwards to `origin/main` and releases.
   While the PC has uncommitted work, the updater pulls nothing (it never merges over someone's
   edits): commit and push on the PC, and it carries on.

If both machines committed, the PC's checkout can't fast-forward. The updater says so in its log;
on the PC, `git pull --rebase && git push` joins them (and resolve any conflict).

GitHub Actions (`.github/workflows/ci.yml`) runs the checks on every push. It deploys nothing.

## Security

- **No open ports, no public IP.** cloudflared on the PC dials out to Cloudflare; nothing listens
  on the internet. The app's port is bound to the PC's localhost (for checks), and the tunnel
  reaches it inside Docker's network.
- **One origin.** The web app and the API share lms.shades.md: first-party `SameSite=Strict`
  cookies, no CORS, CSRF checks on every write. Every page gets a fresh CSP nonce.
- **The visitor's address** comes from Cloudflare's `cf-connecting-ip` (sign-in rate limits use it);
  only cloudflared can reach the app, so it can't be forged from outside.
- **Access keys** (Settings → Claude access) are scoped (read only / kitchen / everything), stored
  hashed, shown once, revocable. Sign-in is rate limited.
- **Secrets live in `deploy/.env` on the PC only** (readable by its user). None are in the repo or
  in GitHub.
- **Backups** stay on the PC (`deploy/backups`). Copy them off the machine now and then (below).
- **The updater** controls Docker through its socket (that is root on the PC's Docker). It has no
  network listener and runs only this repo's script, as the checkout's owner.
- **A change made on the PC is live at once**, without a review. `live.sh` runs the checks and the
  release rolls back an unhealthy version, but a wrong-but-healthy change goes out. Look at the
  result in the app after each one.

**The repository is public today.** Fine for the code (no secrets in it), but it shows the whole
app to anyone. Make it private (GitHub → Settings → General → Danger Zone → Change visibility); the
PC then needs a GitHub token to pull (`gh auth login` in WSL).

## One-time setup

### Cloudflare

1. **Tunnel**: Zero Trust → Networks → Tunnels → Create a tunnel (Cloudflared) → copy its token
   (setup.sh asks for it). **Public hostname**: `lms.shades.md` → Service `HTTP`, `api:8790`.
2. If an older setup exists: delete the `lms` Worker (Workers & Pages), the `lms-api.shades.md`
   hostname and its Access application and service token. Nothing uses them now.
3. **Check**: `yarn deploy:verify` from any machine.

### GitHub

**Protect `main`** (optional): Settings → Branches → require the "Checks" status. Note that the PC
pushes to `main` too.

### The Windows PC

1. **WSL and Docker**: in PowerShell as Administrator `wsl --install -d Ubuntu`, restart. Install
   Docker Desktop: Settings → General → "Use the WSL 2 based engine", Resources → WSL integration →
   Ubuntu on.
2. **Keep it running**: `powershell -ExecutionPolicy Bypass -File deploy\windows\keep-awake.ps1`
   (no sleep on mains power; Docker Desktop starts at sign-in), and turn on automatic sign-in
   (`netplwiz`) so a Windows Update restart brings everything back unattended.
3. **The repo, inside WSL** (Ubuntu terminal): `sudo apt install -y git`, then
   `git clone https://github.com/CristianBrinza/lms.git ~/lms` (a private repo: `gh auth login`
   first), and `git config --global user.name/user.email` for commits made there. Inside WSL, not
   on `C:`: faster, and no Windows line endings.
4. **Node (for the checks and for working there)**: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs && sudo npm i -g yarn`,
   then `cd ~/lms && yarn setup`. Without it, `live.sh` skips the checks.
5. **Setup**: `cd ~/lms && deploy/server/setup.sh`. It checks Docker, writes `deploy/.env`
   (generating the database password, the JWT secret and the push keys; asking for the address,
   the tunnel token and the first admin), builds the app and starts everything. From then on the
   updater keeps it current.
6. **Check**: `deploy/server/status.sh`, then `yarn deploy:verify`.

## Claude on production

- **Data** (food, recipes, the plan, lists, training): through the app with an access key, from
  any machine — the skill `.claude/skills/lms-production`.
  - **MCP with sign-in (best, any device)**: point the assistant at `https://lms.shades.md/api/mcp`.
    It finds LMS's sign-in by itself (OAuth 2.1 with PKCE, `backend/src/modules/oauth.ts`): a
    browser opens LMS, you sign in and pick what it may do (read only / kitchen / everything),
    and it gets its own access key, listed and revocable in Settings → Claude access.
    - Claude Code: `claude mcp add --transport http --scope user lms https://lms.shades.md/api/mcp`,
      then `/mcp` → lms → Authenticate.
    - Codex: `codex mcp add lms --url https://lms.shades.md/api/mcp`, then `codex mcp login lms`.
    - claude.ai / the Claude app / ChatGPT: Settings → Connectors → add a custom connector with
      that address → Connect.
  - **Or a key by hand**: in the app, Settings → Claude access → new key, scope "Kitchen", then
    `claude mcp add --transport http --scope user lms https://lms.shades.md/api/mcp --header "Authorization: Bearer <key>"`
    (or the connector URL `https://lms.shades.md/api/mcp/k/<key>` for clients without headers).
  - **Or the CLI**: `node scripts/lms.mjs login` (the key is asked for, hidden, and kept in
    `~/.config/lms/production.env`, readable by you only). Then `node scripts/lms.mjs whoami`,
    `node scripts/lms.mjs GET /api/food/overview`, …
  - **Cloud sessions**: set `LMS_KEY` (and `LMS_URL` if not production) in the environment's settings.
- **Code, on the PC**: Claude Code in WSL in `~/lms` edits, runs `deploy/server/live.sh`, checks
  the app, commits and pushes. Rules in `CLAUDE.md`; the server itself in the skill
  `.claude/skills/lms-server`.

## Two Claudes: development and the server

The Windows PC runs its own Claude (the desktop app, with Claude Code inside WSL in `~/lms`), with
Remote Control on, named **"LMS production server"**. This Mac's session is **"LMS development"**.

- From a browser, Cristian opens either session and talks to it.
- Either can message the other: "is abc1234 live?", "send me the app's log", "changed X live and
  pushed def5678".
- Both can change code. Say before starting a change, so the two don't edit the same thing at
  once; a conflict is solved with `git pull --rebase` on the side that pushes second.

## Day to day

| What                                   | How                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| What runs, which version, last backups | `deploy/server/status.sh` (on the PC) · `node scripts/lms.mjs health` (anywhere)                |
| Put a change made on the PC live       | `deploy/server/live.sh` (then commit and push)                                                  |
| The updater's log                      | `docker compose logs -f updater` (in `~/lms/deploy`); a failed build: `deploy/state/build.log`  |
| The app's log                          | `docker compose logs --tail 200 api`                                                            |
| A backup now                           | `deploy/server/backup-now.sh`                                                                   |
| Restore                                | `deploy/server/restore.sh deploy/backups/<file>.dump` (saves the current data first)            |
| Hold a version                         | leave a local change in the checkout (the updater pulls nothing), or stop the updater           |
| Copy backups off the PC                | e.g. a OneDrive folder: `cp deploy/backups/lms-*.dump /mnt/c/Users/<you>/OneDrive/lms-backups/` |

**The site doesn't load** (a Cloudflare error page): the tunnel can't reach the app. In order: is
the PC on and signed in? Docker Desktop running? `deploy/server/status.sh`. The tunnel's log
(`docker compose logs tunnel`) shows Cloudflare connection problems.

## Testing the pipeline

`deploy/test/e2e.sh` runs the whole thing on local Docker, with a bare git repo for GitHub: the
first start built from the checkout, a pushed commit pulled and released with its backup, a broken
commit rolled back and not retried, the fix, an edit made on the PC (the updater leaves it alone,
`live.sh` puts it live), a backup and a restore. It uses its own project name and ports, so a dev
database next to it is untouched. `KEEP=1` leaves it running to look at.
