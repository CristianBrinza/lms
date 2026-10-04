---
name: lms-server
description: Use on the LMS production machine (the always-on Windows PC, repo at ~/lms in WSL, deploy/.env present) for anything about the server — is it up, which version runs, logs, why the app is unavailable, putting a code change made here live (live.sh), backups and restores, first-time setup, the Cloudflare tunnel, Docker Desktop, keeping the PC awake — and when the development session asks for the server's status or logs.
---

# Running the LMS server

You are on production. The stack is `~/lms/deploy/docker-compose.yml`: `postgres`, `api` (the web
app and the API in one image, built here from this checkout), `tunnel` (cloudflared, serving
lms.shades.md), `updater`, `backup`. Run commands from `~/lms` (inside WSL on the Windows PC). The
runbook is docs/production.md.

## Changing code here

What you change here is live for every user as soon as `live.sh` finishes. So:

1. `git pull` first (the updater pulls nothing while there are local changes).
2. Make the change. Keep it small; say what you're changing to the "LMS development" session if
   it may be working on the same thing.
3. `deploy/server/live.sh`: `yarn verify`, then build → backup → switch → health check, and the
   previous version back by itself if the new one isn't healthy.
4. Open the app and look at the change. Wrong but healthy is still live: fix forward, or undo the
   edit (`git checkout -- <file>`) and run `live.sh` again.
5. Commit and push (no AI attribution lines). Until then the updater leaves this checkout alone.

## Never

- Print, copy or message the contents of `deploy/.env`, keys, tokens or passwords.
- `docker compose down -v`, `docker volume rm`, or anything that removes the `db-data` volume.
- Edit the database by hand. Data changes go through the app (the `lms-production` skill).
- `git push --force`, `git reset --hard` over someone's work, or leave uncommitted changes
  behind at the end of a task (they stop updates from GitHub).
- Restore a backup, change `deploy/.env`, or stop the stack without Cristian saying so.

## Look

| Question               | Command                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Everything at a glance | `deploy/server/status.sh`                                                             |
| What the updater did   | `cat deploy/state/status.json`; `cd deploy && docker compose logs --tail 100 updater` |
| App errors             | `cd deploy && docker compose logs --tail 200 api`                                     |
| A failed build         | `deploy/state/build.log`                                                              |
| Tunnel / Cloudflare    | `cd deploy && docker compose logs --tail 100 tunnel`                                  |
| Backups                | `ls -lh deploy/backups`                                                               |
| Live from outside      | `node scripts/lms.mjs health`                                                         |

## Fix

- **Site doesn't load**: `status.sh`. Containers down → `cd deploy && docker compose up -d`.
  Docker not running → Docker Desktop. Tunnel errors → its log; the token in `deploy/.env` may be wrong.
- **A release rolled back** (`result: rolled-back`): the new version wasn't healthy; the previous
  one runs. The app's log of the failed start says why; fix it in a new commit (here, or ask the
  development session).
- **The build failed** (`result: failed`): nothing changed; `deploy/state/build.log` says why.
- **"Both have moved on"** in the updater's log: commits here and on GitHub. `git pull --rebase`,
  resolve, `live.sh`, `git push`.
- **Backup now**: `deploy/server/backup-now.sh`. **Restore** (only when asked):
  `deploy/server/restore.sh deploy/backups/<file>.dump` — it saves the current data first.
- **First-time setup**: docs/production.md, "The Windows PC"; then `deploy/server/setup.sh`.

## Reporting

To Cristian or the development session: what you checked, what you found (version, result, the
relevant log lines with anything secret removed), what you did, what you changed and pushed, and what still needs doing.
