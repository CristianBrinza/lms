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
2. **Pushed from elsewhere** (the Mac, a cloud session): to `main`, **signed** (below). The PC's
   updater checks every minute; when its checkout has no local changes and every new commit is
   signed by an allowed key, it fast-forwards to `origin/main` and releases. While the PC has
   uncommitted work, the updater pulls nothing (it never merges over someone's edits): commit and
   push on the PC, and it carries on.

If both machines committed, the PC's checkout can't fast-forward. The updater says so in its log;
on the PC, `git pull --rebase && git push` joins them (and resolve any conflict).

GitHub Actions (`.github/workflows/ci.yml`) runs the checks on every push. It deploys nothing.

## Security

- **No open ports, no public IP.** cloudflared on the PC dials out to Cloudflare; nothing listens
  on the internet. The app's port is bound to the PC's localhost (for checks), and the tunnel
  reaches it inside Docker's network.
- **The tunnel reaches the app and nothing else.** Two Docker networks: `edge` (cloudflared and
  the app) and `data` (the app, PostgreSQL, the backups; internal, no way out). The updater has a
  network of its own. The tunnel is managed in the Cloudflare dashboard, so anyone in the
  Cloudflare account could add a hostname; it can still only point at `api:8790`, because
  `postgres` and the updater don't exist on cloudflared's network. `deploy/test/e2e.sh` checks it.
- **Only signed commits deploy** (below): a stolen GitHub account or token can push, but the PC
  won't run it.
- **Pinned images.** PostgreSQL, cloudflared, Node and the Docker CLI are pinned by version and
  digest; Dependabot (`.github/dependabot.yml`) proposes the bumps once a month.
- **Least power.** The app and cloudflared run with a read-only root, a tmpfs `/tmp`, no Linux
  capabilities, `no-new-privileges`, and memory, CPU and process limits (the app 1 GB / 2 CPUs,
  the tunnel 256 MB / 1 CPU), so a flood or a bug can't starve the PC. The app runs as the
  image's `node` user and writes nothing to disk. PostgreSQL, the backups and the updater get
  `no-new-privileges` too. cloudflared's metrics listen on its own loopback only.
- **One origin.** The web app and the API share lms.shades.md: first-party `SameSite=Strict`
  cookies, no CORS, CSRF checks on every write. Every page gets a fresh CSP nonce.
- **Only its own host.** The app answers `Host: lms.shades.md` (APP_URL) and localhost (checks);
  anything else gets 421, so DNS rebinding or a stray tunnel route reaches nothing.
- **The visitor's address** comes from Cloudflare's `cf-connecting-ip` (sign-in rate limits use
  it), believed only when the request comes from the tunnel's container (`TRUST_PROXY: tunnel`) or
  from inside the app's container. Anything else that reaches the port gets its own address.
- **Access keys** (Settings → Claude access) are scoped (read only / kitchen / everything), stored
  hashed, shown once, revocable. Sign-in is rate limited.
- **Secrets live in `deploy/.env` on the PC only**, mode 600 (setup.sh keeps it so;
  `status.sh` warns otherwise). None are in the repo or in GitHub. The tunnel token goes to the
  tunnel container only, never to the app, and no script prints it or the database password.
  Never paste either into a chat or a log; if the token leaks, rotate it (the tunnel → Refresh
  token) and update `deploy/.env`.
- **Backups** stay on the PC (`deploy/backups`). Copy them off the machine now and then (below);
  an automatic, encrypted off-site copy is a follow-up.
- **The updater** controls Docker through its socket (that is root on the PC's Docker). It has no
  network listener and runs only this repo's script, as the checkout's owner. That is why it only
  takes signed commits.
- **A change made on the PC is live at once**, without a review. `live.sh` runs the checks and the
  release rolls back an unhealthy version, but a wrong-but-healthy change goes out. Look at the
  result in the app after each one.

**The repository is public today.** Fine for the code (no secrets in it), but it shows the whole
app to anyone. Make it private (GitHub → Settings → General → Danger Zone → Change visibility); the
PC then needs a GitHub token to pull (`gh auth login` in WSL).

## One-time setup

### Cloudflare

1. **Tunnel**: Zero Trust → Networks → Tunnels → Create a tunnel (Cloudflared) → copy its token
   (setup.sh asks for it, hidden). **One tunnel per app**: LMS has its own, never shared with the
   CRM or anything else, so revoking one doesn't take the others down.
2. **Its routes, exactly**: one public hostname, `lms.shades.md` → Service `HTTP`, `api:8790`, and
   the catch-all `http_status:404`. Nothing else, ever: no SSH, RDP, database, Docker or
   `localhost` routes. Look at the list now and then; a route you didn't add means someone is in
   the Cloudflare account.
3. **Notifications** (Notifications → Add): "Tunnel Health Alert" and "Tunnel Creation or
   Deletion Event", to your email. Cloudflare has no alert for a new connector, so look at the
   tunnel's Connectors now and then: exactly one, the PC. Another one is someone with the token:
   rotate it (the tunnel → Refresh token, then the new one in `deploy/.env` and
   `docker compose up -d tunnel`). Two-factor on the Cloudflare account, and as few members as
   possible: anyone in it can change the tunnel's routes.
4. If an older setup exists: delete the `lms` Worker (Workers & Pages), the `lms-api.shades.md`
   hostname and its Access application and service token. Nothing uses them now.
5. **Check**: `yarn deploy:verify` from any machine.

### Signed deploys

The updater deploys a commit from GitHub only when it, and every commit before it that isn't on the
PC yet, is signed by a key in the PC's `allowed_signers` file. The file lives outside the repo
(`~/.config/lms/allowed_signers`, the path in `deploy/.env` as `LMS_ALLOWED_SIGNERS`), so a
commit can't add its own key. Anything else is logged (`docker compose logs updater`: "signatures:
REFUSED …"), `status.sh` shows `refused`, and nothing is pulled. `live.sh` is exempt: it releases
edits a person made on the PC itself.

1. **On the Mac and on the PC (in WSL)**, once each, sign every commit with an SSH key:
   ```sh
   ssh-keygen -t ed25519 -C "lms signing" -f ~/.ssh/lms_signing   # or use an existing key
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/lms_signing.pub
   git config --global commit.gpgsign true
   git config --global tag.gpgsign true
   ```
   With a passphrase on the key, add it to the agent (`ssh-add ~/.ssh/lms_signing`; on the Mac
   `ssh-add --apple-use-keychain`). Check: `git commit --allow-empty -m test && git log --show-signature -1`.
2. **GitHub**: Settings → SSH and GPG keys → New SSH key → Key type **Signing Key** → paste each
   `~/.ssh/lms_signing.pub`. Commits then show "Verified".
3. **The PC's allowed_signers**: `deploy/server/setup.sh` asks for the keys (one line each,
   `email ssh-ed25519 AAAA…`). By hand: `echo "you@example.com namespaces=\"git\" $(cat key.pub)" >> ~/.config/lms/allowed_signers`.
   Both the Mac's and the PC's keys go in. The updater reads it on every round.
4. **Protect `main`**: Settings → Rules → Rulesets → New branch ruleset → target `main` →
   "Require signed commits" and "Require status checks to pass" (Checks), and block force pushes.
   Merge pull requests from the command line (`git merge --ff-only` or a signed merge, then
   `git push`), not with GitHub's merge button: its commits are signed by GitHub's key, which the
   PC doesn't trust.
5. **The escape hatch**: `LMS_ALLOW_UNSIGNED=1` in `deploy/.env`, then `docker compose up -d updater`,
   deploys unsigned commits too (the log says so for each). Only while setting signing up; put it
   back to 0 (or remove it) right after.

**If something unsigned reaches `main`** (a mistake, or someone else): the PC holds the last good
version, and stays there even when signed commits land on top. Find out who pushed it; then put
`main` back on the last good commit, signed, and force-push once (lift the ruleset's force-push
block for that): `git reset --hard <good> && git push --force-with-lease`. The PC carries on.

### GitHub

Besides the ruleset above: **two-factor** on the account, no personal access tokens you don't
use, and no deploy keys or apps with write access you don't know.

### The Windows PC

1. **WSL and Docker**: in PowerShell as Administrator `wsl --install -d Ubuntu`, restart. Install
   Docker Desktop: Settings → General → "Use the WSL 2 based engine", Resources → WSL integration →
   Ubuntu on.
2. **Keep it running**: `powershell -ExecutionPolicy Bypass -File deploy\windows\keep-awake.ps1`
   (no sleep on mains power; Docker Desktop starts at sign-in), and turn on automatic sign-in
   (`netplwiz`) so a Windows Update restart brings everything back unattended. Only together with
   BitLocker and a screen that locks itself (step 7).
3. **The repo, inside WSL** (Ubuntu terminal): `sudo apt install -y git`, then
   `git clone https://github.com/CristianBrinza/lms.git ~/lms` (a private repo: `gh auth login`
   first), and `git config --global user.name/user.email` for commits made there. Inside WSL, not
   on `C:`: faster, and no Windows line endings.
4. **Node (for the checks and for working there)**: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs && sudo npm i -g yarn`,
   then `cd ~/lms && yarn setup`. Without it, `live.sh` skips the checks.
5. **Setup**: `cd ~/lms && deploy/server/setup.sh`. It checks Docker, writes `deploy/.env`
   (mode 600; generating the database password, the JWT secret and the push keys; asking for the
   address, the tunnel token and the first admin), creates `~/.config/lms/allowed_signers` and asks
   for the signing keys, builds the app and starts everything. From then on the updater keeps it
   current. Safe to run again: it only adds what's missing.
6. **Check**: `deploy/server/status.sh`, then `yarn deploy:verify`.
7. **Lock the PC down** (by hand, once; then now and then):
   - **Router**: no port forwards to the PC, and UPnP off.
   - **Windows Firewall** on for every network profile (Domain, Private, Public).
   - **Remote Desktop** off (Settings → System → Remote Desktop), or reachable only through
     Cloudflare Access for Infrastructure, never a tunnel route.
   - **BitLocker** on for the system drive (Settings → Privacy & security → Device encryption, or
     BitLocker on Pro). Automatic sign-in only with BitLocker and a screen that locks itself.
   - **WSL networking stays NAT**: no `networkingMode=mirrored` in `%UserProfile%\.wslconfig`, so
     ports bound to localhost stay on the PC.
   - **Docker Desktop**: Settings → General → "Expose daemon on tcp://localhost:2375 without TLS"
     stays off.
   - **Remote-desktop tools** (AnyDesk, TeamViewer, Chrome Remote Desktop, …) removed, or locked
     with two-factor and an allow-list.
   - **Windows Update** on.

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

| What                                   | How                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| What runs, which version, last backups | `deploy/server/status.sh` (on the PC) · `node scripts/lms.mjs health` (anywhere)                              |
| Put a change made on the PC live       | `deploy/server/live.sh` (then commit and push)                                                                |
| The updater's log                      | `docker compose logs -f updater` (in `~/lms/deploy`); a failed build: `deploy/state/build.log`                |
| The app's log                          | `docker compose logs --tail 200 api`                                                                          |
| A backup now                           | `deploy/server/backup-now.sh`                                                                                 |
| Restore                                | `deploy/server/restore.sh deploy/backups/<file>.dump` (saves the current data first)                          |
| Hold a version                         | leave a local change in the checkout (the updater pulls nothing), or stop the updater                         |
| Copy backups off the PC                | e.g. a OneDrive folder: `cp deploy/backups/lms-*.dump /mnt/c/Users/<you>/OneDrive/lms-backups/`               |
| A push isn't deployed ("refused")      | `docker compose logs updater \| grep signatures`: an unsigned commit, or a key missing from `allowed_signers` |

**The site doesn't load** (a Cloudflare error page): the tunnel can't reach the app. In order: is
the PC on and signed in? Docker Desktop running? `deploy/server/status.sh`. The tunnel's log
(`docker compose logs tunnel`) shows Cloudflare connection problems.

## Testing the pipeline

`deploy/test/e2e.sh` runs the whole thing on local Docker, with a bare git repo for GitHub: the
first start built from the checkout, what the tunnel can reach (a stand-in on cloudflared's
networks: the app yes, PostgreSQL no, by name or address; a foreign `Host` gets 421), a signed
commit pulled and released with its backup, a broken commit rolled back and not retried, the fix,
unsigned commits refused (also under a signed one), an edit made on the PC (the updater leaves it
alone, `live.sh` puts it live), a backup and a restore. It uses its own project name and ports, so a dev
database next to it is untouched. `KEEP=1` leaves it running to look at.

## Follow-up: backups off the PC

Today the dumps stay in `deploy/backups` on the PC: a dead disk, a theft or ransomware on the PC
takes them with the database. The plan (security plan B1): every night, the newest dump encrypted
(`restic` or `age`) and copied to Cloudflare R2 with a bucket key that can write but not delete,
versioning or object lock on, 30 dailies and 12 monthlies kept, and a scripted restore into a
scratch database once a month that emails its result. Until then, copy them off by hand (Day to
day, above).
