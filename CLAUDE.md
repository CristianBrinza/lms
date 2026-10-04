# LMS — notes for Claude

LMS is a private family PWA: `frontend/` (React, Vite) and `backend/` (Hono, PostgreSQL). In
production both run on one always-on Windows PC, reached through a Cloudflare Tunnel at
lms.shades.md. README.md describes the app; docs/production.md how it runs.

## Which machine am I on?

There are two machines with a Claude on them. Both may change code; only one is production.

|                       | Development (Cristian's Mac, or a cloud session)   | Production (the always-on Windows PC, in WSL)                                     |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| How to tell           | no `deploy/.env`, a dev database from `yarn db:up` | `deploy/.env` exists and `docker compose ps` in `deploy/` shows `updater` running |
| What happens here     | features, fixes, tests, commits, pushes            | the server (status, logs, backups, restores) and changes that should go live now  |
| A change goes live by | push to `main` → the PC's updater pulls and builds | `deploy/server/live.sh` → then commit and push                                    |

**On production, a code change is live for everyone the moment `live.sh` finishes.** So:

- Before editing: `git pull` (the updater doesn't pull while the checkout has local changes).
- Make the change, then `deploy/server/live.sh` (checks, build, backup, switch, health check;
  rolls back by itself if unhealthy). Look at the result in the app.
- Then commit and push, so the Mac and GitHub have it. Until then the updater leaves this
  checkout alone and pulls nothing.
- Never edit `deploy/.env`'s secrets into anything, never touch the database directly (use the
  app, or `deploy/server/restore.sh` for backups), never `docker compose down -v`.
- Use the `lms-server` skill for status, logs, backups and restores.

**On development, never deploy to the PC by hand.** Push to `main`; the PC's updater pulls it
within a minute (if the PC has no local changes) and releases it. To check the server, ask the
production session, or `node scripts/lms.mjs health` / `yarn deploy:verify` from anywhere.

## Talking between the two

Both Claude sessions can run with Remote Control on, so Cristian can open either from a browser,
and each can message the other (its session appears in the other's agent list). Name them so
they're easy to find: **"LMS development"** and **"LMS production server"**.

- Development → production: "pushed abc1234; is it live?", "run status.sh and send me the result",
  "the API 500s on /api/food/plan/needs — send me the last 100 lines of the app's log".
- Production → development: "changed X live and pushed def5678", logs and errors (secrets
  removed). Never send `deploy/.env` contents, keys or tokens in a message.
- Both editing at once makes git conflicts: say what you're about to change before you start.

## Production data (food, recipes, the plan)

From either machine, through the app with an access key — the `lms-production` skill. Not by
editing the database.

## Working on code (either machine)

- `yarn verify` before saying something is done (typecheck, lint, tests, builds). The frontend
  typecheck is `tsc -b`. On the PC, `live.sh` runs it first.
- Commits have no AI attribution lines.
- Design: the fixed LMS palette, flat surfaces with soft shadows, MUI Rounded icons only, red only
  in the logo; phone first, real tablet layouts from 44rem, desktop from 64rem.
- Changes to the server's pipeline (compose, updater, live.sh): `deploy/test/e2e.sh` tests them
  on local Docker.
