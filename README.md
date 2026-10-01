# LMS — Life Management System

A private app for family and friends: one place for the areas of a life (Training and Food today,
10+ later). It installs on a phone's Home Screen like a native app, stays signed in, and updates
itself as soon as a new version is live.

- **Members** sign in with the email and password the admin gave them, choose their own password
  at first sign-in, and open their areas from Home.
- **Admins** create every account (there is no sign-up), reset passwords, switch people off, sign
  them out everywhere, make other admins and delete accounts (`/admin/users`, or Settings → People).
- **`/`** asks a first-time visitor "browser or app"; **`/app`** walks iPhone, Android and computers
  through installing.

## Stack

| Part | Tech |
| --- | --- |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, React Router, vite-plugin-pwa, MUI icons. Served by a Cloudflare Worker (Wrangler) that also proxies `/api`. |
| `backend/` | Node.js 22, Hono, PostgreSQL (`pg`, numbered migrations), zod, jose (JWT in httpOnly cookies). Runs in Docker behind a Cloudflare Tunnel. |
| `deploy/` | Docker Compose for the server: PostgreSQL + API + cloudflared. |

```
Browser ──https──▶ Cloudflare Worker (lms.example.com)
                    ├─ static app (frontend/dist)
                    └─ /api/* ──▶ Cloudflare Tunnel (lms-api.example.com) ──▶ API container ──▶ PostgreSQL
```

The browser only ever talks to the app's own address: cookies are first-party and there is no
CORS. The Worker adds a shared key (`PROXY_SECRET`) to every API request; the API answers a bare
404 to anything without it, so the public tunnel hostname can't be used to get around the app.

## Run it locally

Requirements: Node.js 22+, Yarn 1, Docker.

```bash
yarn setup                                  # install root, backend and frontend
yarn db:up                                  # PostgreSQL 16 on localhost:5433
cp backend/.env.template backend/.env       # set JWT_SECRET and the first admin (ADMIN_*)
yarn dev                                    # API on :8790, app on http://localhost:5190
```

The first admin is created on start from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when there is no admin
yet, or any time with:

```bash
yarn create-admin --email you@example.com --name Cristian --surname Brinza
```

To try it on a phone on the same Wi-Fi: `yarn --cwd frontend dev:lan` and open the "Network"
address. "Add to Home Screen" works there too.

## Checks

```bash
yarn verify       # typecheck, lint, tests and production builds of both apps
```

Backend tests run against a real PostgreSQL (`lms_test` on the `yarn db:up` server, created
automatically, or `TEST_DATABASE_URL`).

## Deploy

One-time setup:

1. **Tunnel**: Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create a tunnel
   (Cloudflared). Copy its token. Add a public hostname, e.g. `lms-api.example.com`, with service
   `HTTP` → `api:8790`.
2. **Server settings**: `cp deploy/.env.template deploy/.env` and fill it in (database password,
   `APP_URL`, `JWT_SECRET`, `PROXY_SECRET`, `TUNNEL_TOKEN`, first admin).
3. **Deploy settings**: `cp .env.deploy.template .env.deploy` and fill in `API_ORIGIN` (the tunnel
   hostname) and `APP_URL`, plus a Cloudflare API token (or run `npx wrangler login` in `frontend/`).
4. Give the Worker the shared key: `yarn deploy secrets`.
5. Optional: a custom domain for the app in `frontend/wrangler.jsonc` (`routes`).

Then, every time:

```bash
yarn deploy              # API (Docker + tunnel on this machine), then the web app, then live checks
yarn deploy api          # only the API stack
yarn deploy web          # only the web app (Worker + assets)
yarn deploy verify       # only the live checks (also: yarn deploy:verify)
yarn deploy --dry-run    # build everything, change nothing
```

The API runs wherever `yarn deploy api` runs (a home server, a mini PC, this Mac). On another
machine: clone the repo there, add `deploy/.env`, and run `yarn deploy api` on it.

Backups: `docker compose -f deploy/docker-compose.yml exec postgres pg_dump -U lms lms > lms-$(date +%F).sql`

## How updates reach installed apps

Every build writes a `version.json`. Open apps check it every minute (and on focus/return), the
new service worker takes over at once, and the app reloads itself where it is. In the middle of a
form it waits and offers "Update" instead, so nothing typed is lost. Sessions live in cookies, so
nobody is signed out by an update.

## Sessions

- Access token: 15-minute JWT in an httpOnly, SameSite=Strict cookie.
- Refresh token: rotated on every refresh, stored hashed; "Keep me signed in" (on by default) keeps
  it for a year, otherwise until the browser closes. A refresh token reused after rotation ends
  that session (theft detection).
- Changing a password, switching someone off or "sign out everywhere" invalidates every token at
  once. Sign-in is rate limited per IP and per email.

## Adding a life area

Areas live in `frontend/src/areas/registry.ts`. Today Training and Food are dashboard tiles only;
a tap says they're being built. To give one its screen: build the page, add its route in
`frontend/src/app/router.tsx`, and set `to: '/training'` on its registry entry — the tile becomes
a link. A new area is one more registry entry; the dashboard grid takes 10+.

## Brand

The logo is `frontend/brand/logo.svg`. Icons, the favicon and the iOS launch screens are
generated from it on every build (`yarn --cwd frontend brand` forces it).
