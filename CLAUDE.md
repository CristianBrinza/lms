# LMS — notes for Claude

LMS is a private family PWA: `frontend/` (React, Vite, Cloudflare Worker at lms.shades.md) and
`backend/` (Hono, PostgreSQL). README.md describes the app; docs/production.md how it runs.

## Which machine am I on?

There are two machines with a Claude on them, and they do different jobs.

|                             | Development (Cristian's Mac, or a cloud session)   | Production (the always-on Windows PC)                                             |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| How to tell                 | no `deploy/.env`, a dev database from `yarn db:up` | `deploy/.env` exists and `docker compose ps` in `deploy/` shows `updater` running |
| What happens here           | code: features, fixes, tests, commits, pushes      | the server: status, logs, backups, restores, setup, Cloudflare tunnel             |
| Changes reach production by | push to `main` → CI → the PC's updater             | — (never edit code here)                                                          |

**On production, never edit, commit or pull code by hand.** The updater fast-forwards this checkout
by itself; local changes stop it from updating. A code change is the development side's job: say
what's needed (or message the development session, see below). Use the `lms-server` skill.

**On development, never deploy to the PC by hand.** Push; CI and the updater do the rest. To check
the server, ask the production session, or `node scripts/lms.mjs health` from anywhere.

## Talking between the two

Both Claude sessions can run with Remote Control on, so Cristian can open either from a browser,
and each can message the other (its session appears in the other's agent list). Name them so
they're easy to find: **"LMS development"** and **"LMS production server"**.

- Development → production: "pushed abc1234; is it live?", "run status.sh and send me the result",
  "the API 500s on /api/food/plan/needs — send me the last 100 lines of the api log".
- Production → development: logs and errors (secrets removed), what the server is running, what
  a fix needs. Never send `deploy/.env` contents, keys or tokens in a message.

## Production data (food, recipes, the plan)

From either machine, through the app with an access key — the `lms-production` skill. Not by
editing the database.

## Working here (development)

- `yarn verify` before saying something is done (typecheck, lint, tests, builds). The frontend
  typecheck is `tsc -b`.
- Commits have no AI attribution lines.
- Design: the fixed LMS palette, flat surfaces with soft shadows, MUI Rounded icons only, red only
  in the logo; phone first, real tablet layouts from 44rem, desktop from 64rem.
- Pipeline changes: `deploy/test/e2e.sh` tests them on local Docker.
