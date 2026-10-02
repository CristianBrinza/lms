---
name: lms-server
description: Use on the LMS production machine (the always-on Windows PC, repo at ~/lms in WSL, deploy/.env present) for anything about the server — is it up, which version runs, logs, why the app is unavailable, backups and restores, first-time setup, the Cloudflare tunnel, Docker Desktop, keeping the PC awake — and when the development session asks for the server's status or logs.
---

# Running the LMS server

You are on production. The stack is `~/lms/deploy/docker-compose.yml`: `postgres`, `api` (an image
CI published), `tunnel` (cloudflared), `updater`, `backup`. Run commands from `~/lms` (inside WSL
on the Windows PC). The runbook is docs/production.md.

## Never

- Edit, commit, pull, reset or check out code here. The updater fast-forwards this checkout from
  `origin/main` by itself; local changes stop updates. Code changes belong to the development
  session: tell Cristian, or message the "LMS development" session, what's needed.
- Print, copy or message the contents of `deploy/.env`, keys, tokens or passwords.
- `docker compose down -v`, `docker volume rm`, or anything that removes the `db-data` volume.
- Restore a backup, change `deploy/.env`, or stop the stack without Cristian saying so.

## Look

| Question               | Command                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Everything at a glance | `deploy/server/status.sh`                                                             |
| What the updater did   | `cat deploy/state/status.json`; `cd deploy && docker compose logs --tail 100 updater` |
| API errors             | `cd deploy && docker compose logs --tail 200 api`                                     |
| Tunnel / Cloudflare    | `cd deploy && docker compose logs --tail 100 tunnel`                                  |
| Backups                | `ls -lh deploy/backups`                                                               |
| Live from outside      | `node scripts/lms.mjs health`                                                         |

## Fix

- **App "temporarily unavailable"**: `status.sh`. Containers down → `cd deploy && docker compose up -d`.
  Docker not running → Docker Desktop. Tunnel errors → its log; the token in `deploy/.env` may be wrong.
- **The updater rolled back** (`result: rolled-back`): the new API wasn't healthy; the previous one
  runs. Send the API log of the failed start to the development session — the fix is a new commit.
- **Hold a version**: `LMS_TAG=sha-<commit>` in `deploy/.env`, then `cd deploy && docker compose up -d api`
  (with Cristian's OK). Remove it to follow `main` again.
- **Backup now**: `deploy/server/backup-now.sh`. **Restore** (only when asked):
  `deploy/server/restore.sh deploy/backups/<file>.dump` — it saves the current data first.
- **First-time setup**: docs/production.md, "The Windows PC"; then `deploy/server/setup.sh`.

## Reporting

To Cristian or the development session: what you checked, what you found (version, result, the
relevant log lines with anything secret removed), what you did, and what still needs a code change.
