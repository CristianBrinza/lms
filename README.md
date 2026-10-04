# LMS — Life Management System

A private app for family and friends: one place for the areas of a life. Food and Training are
built; 10+ more areas come later. It installs on a phone's or iPad's Home Screen like a native app,
stays signed in, and updates itself as soon as a new version is live.

- **Members** sign in with the email and password the admin gave them, choose their own password
  at first sign-in, and open their areas from Home.
- **Admins** create every account (there is no sign-up), reset passwords, switch people off, sign
  them out everywhere, make other admins and delete accounts (`/admin/users`, or Settings → People).
- **`/`** asks a first-time visitor "browser or app"; **`/app`** walks iPhone, Android and computers
  through installing.

It is made for three screens: phones first, then iPads and computers, each with its own layout.

| Screen                          | Navigation         | Layouts                                                                                        |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| Phone                           | Bottom menu        | One column; sheets rise from the bottom                                                        |
| iPad, from 744 px (`md`, 44rem) | A rail at the left | Lists beside details: kitchen, shopping, the plan; Today in two columns; cook mode full screen |
| Desktop, from 1024 px (`lg`)    | The full side menu | The plan as a whole week; the four Food cards beside Today                                     |

## Food

One kitchen per household, shared by the family. Everything can also be done by Claude (see
[Claude](#claude)).

### Kitchen

- **What there is, where, until when.** Fridge, freezer, shelf, garden (balcony herbs) and other
  places. Each package or piece is its own lot with its own date. Use soon and opened packages
  come first.
- **Counted the way people count.**
  - Exact amounts for meat and cheese.
  - Full / low / out for basics like spices, sauces and salt.
  - Weighed and poured things convert at about 1 g per ml (300 g of milk ≈ 300 ml).
  - Spoons and cups work for anything weighed.
- **Packages.** A jar of honey of 500 g, a loaf of 20 slices, a jar of 14 pickles, a cake of 10
  pieces, a can of 340 g. Mixed sizes are fine (one 1.25 l bottle and two of 0.5 l). Each one
  shows how full it still is.
- **Kinds.** Cheese: Cheddar, Gouda. Vodka: Finlandia, Absolut. Juice: Apple, Mango-peach. The
  kind is read from what you type ("apple juice", "Coca-Cola Zero", "Borjomi"). A new kind is
  remembered the first time it is used.
- **Opening and freezing.**
  - Opening a package (or cooking part of it) shortens its use-by and moves it where it belongs
    once open: an opened can goes to the fridge.
  - Freezing extends the date; thawing gives it its thawed days.
- **Pouring.** From the big oil bottle into the small one on the desk, from a jug into a bottle.
- **The catalog.** About 270 foods with Romanian and Russian names, Moldovan staples, cans and
  jars, drinks, spirits, syrups and spices. Each comes with its icon, place, keeping time,
  packages and kinds. Unknown names are guessed.

### Shopping

- One list per store (Linella, Metro, your own) plus "any store".
- Lines ask for **at least** an amount, can be important, and say when they're needed. What's
  needed by tomorrow comes first.
- In the shop, tick lines into the cart and say what you really got: two 300 g cans instead of one
  500 g, or one big 1 kg can, of another kind if need be.
- Finishing the shop saves the trip with its prices and puts everything in the kitchen. When you
  got less than needed, the rest stays on the list.

### Recipes

- Ingredients are linked to the kitchen, scaled to how many are eating, and show what's there and
  what's missing. Tapping "Need …" puts it on a list.
- A line can ask for one kind ("Vodka · Finlandia") and can have alternatives ("300 g milk, or
  whipped cream"). It shows which one will be used.
- Allergies and foods people avoid are marked on every recipe and meal (Settings → Kitchen people
  and allergies).
- The kitchenware a recipe needs is shown, with whether it's clean.
- Cook mode shows one big step at a time and keeps the screen on. On a tablet the ingredients sit
  beside the step.

### Plan

- Meals at any time of day, as many a day as you like, snacks included. A meal can be several
  parts: an omelette, a coffee, bread with Philadelphia and salmon on the side, a sauce made
  apart.
- **Reservations.** Planned meals claim what they need, in eating order. A recipe shows what's
  kept for which meal. A line says when what's there goes off before the meal.
- **What to buy.** What the plan is short of goes onto the lists, needed by each meal's day.
- **To go.** To-go meals (a lunch box) show under "Pack tonight" the evening before.
- **Eaten.** Marking a meal eaten takes its ingredients out of the kitchen, makes its kitchenware
  dirty and says what it opened. Undo puts it all back.

### Kitchenware

Pots, pans, bowls, glasses (even pens), with how many are clean, dirty or in the dishwasher.
Washing by hand makes them clean at once; the dishwasher makes them clean when its run is over.

### Reminders

Phone notifications, at times set in Settings → Reminders:

- Shopping before coming home.
- Preparing tomorrow's to-go food.
- Food about to expire.
- A reminder before each meal.
- Your own reminders.

They work from the installed app (on iPhone and iPad: iOS 16.4+, from the Home Screen).

## Training

Home workouts for everyone in the household. Equipment and exercises are shared; plans, sets and
statistics are each person's, and anyone can look at or plan for the others (a person switcher on
every Training screen).

- **What's at home.** Equipment with its weights: dumbbells in pairs or single (2, 4, 8 kg…), a
  kettlebell, a pull-up bar, bands, a treadmill or a running route outside, and so on. 84 home
  exercises each know what they need (with alternatives: dumbbells _or_ a kettlebell), so only
  what can be done at home is offered, with the weights you own. Own exercises can be added.
- **Plan.** A calendar: tap a day, add a workout — made up from what's at home (length, focus,
  level, quiet = no jumping, sets or circuit), from a saved routine, or built by hand as a
  sequence of exercises with sets, targets (reps, time, distance; weight) and rest. Warm-up and
  cool-down are done once; rounds repeat the main block. Move, copy, skip, save as a routine.
- **The player.** Full screen: get ready, then each set with its target, last time and what to
  aim for; timed sets count down by themselves; rest counts down with ±15 s and skip; pause,
  previous, next; beeps, the exercise read aloud, the screen kept awake. Every set is saved as it
  is done, so a reload or another device carries on. Finish with how it felt.
- **A set in passing.** One push-up walking by is logged in a tap (pinned exercises on the
  Training page), or later: earlier today at a time, or on another day.
- **Progress.** Personal bests (most reps, heaviest, strongest set, longest hold, furthest), last
  time and a next target (one more rep; a heavier weight you own), day and week streaks, a
  calendar of days trained, sets per muscle, minutes per week.

## Claude

Nothing in LMS calls an AI. Instead, Claude (or any assistant) works on the kitchen and training
with an **access key** (Settings → Claude access):

- **REST:** `Authorization: Bearer lms_…` on `/api/food/...` and `/api/training/...`. The app and
  the assistant share the same rules.
- **MCP:** `/api/mcp` (key in the `Authorization` header), or `/api/mcp/k/<key>` for clients
  that can't send headers. About 50 tools: the kitchen, adding and using stock, pouring, shopping
  and checkout (and undoing a shop), recipes, the plan and its parts, kitchenware, kitchen people,
  and training (equipment, exercises, planning or making up workouts, logging sets, statistics). The server's
  instructions explain packages, kinds, alternatives and the plan.
- **Scopes:** `food:read` (look only), `food` (the kitchen and training), `admin` (everything).

## Stack

| Part        | Tech                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, React Router, vite-plugin-pwa, MUI icons (Rounded only). Served by a Cloudflare Worker (Wrangler) that also proxies `/api`. |
| `backend/`  | Node.js 22, Hono, PostgreSQL (`pg`, numbered migrations), zod, jose (JWT in httpOnly cookies), web-push. Runs in Docker behind a Cloudflare Tunnel.                                      |
| `deploy/`   | Docker Compose for the server: PostgreSQL + API + cloudflared.                                                                                                                           |

```
Browser ──https──▶ Cloudflare Worker (lms.example.com)
                    ├─ static app (frontend/dist)
                    └─ /api/* ──▶ Cloudflare Tunnel (lms-api.example.com) ──▶ API container ──▶ PostgreSQL
```

The browser only ever talks to the app's own address: cookies are first-party and there is no
CORS. The Worker adds a shared key (`PROXY_SECRET`) to every API request; the API answers a bare
404 to anything without it, so the public tunnel hostname can't be used to get around the app.

### Where things are

| Path                                                             | What                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/modules/food/`                                      | The Food services, shared by the REST routes (`routes.ts`) and the MCP tools: `stock`, `products`, `shopping`, `recipes`, `meals`, `plan`, `allocation` (the plan played forward), `kitchenware`, `restrictions`, `units`, `presets` (the catalog) |
| `backend/src/modules/mcp/`                                       | The MCP server (`server.ts`, instructions and prompts) and its tools (`tools.ts`)                                                                                                                                                                  |
| `backend/src/modules/reminders/`                                 | Reminders, push subscriptions and the scheduler                                                                                                                                                                                                    |
| `backend/src/db/migrations.ts`                                   | Numbered SQL migrations, applied on start                                                                                                                                                                                                          |
| `frontend/src/food/`                                             | Food screens (`pages/`), sheets (`kitchen/`, `shopping/`, `plan/`, `kitchenware/`), shared pieces (`components/`), API client and types                                                                                                            |
| `frontend/src/food/icons/svg/`                                   | One SVG per food and kitchenware icon, shown by `Icon`                                                                                                                                                                                             |
| `backend/src/modules/training/`                                  | Training: `catalog` (equipment and exercises), `library` (what can be done at home), `workouts` (plans, sets, bests, last time), `stats`, `generate` (a workout made up from the equipment)                                                        |
| `frontend/src/training/`                                         | Training screens (`pages/`), the full-screen `player/`, sheets in `components/`, exercise and equipment SVGs in `icons/`                                                                                                                           |
| `frontend/src/components/ui/`, `frontend/src/components/layout/` | The app's own components (buttons, sheets, fields, chips) and the shell (tab bar, side rail, screens)                                                                                                                                              |

## Run it locally

Requirements: Node.js 22+, Yarn 1, Docker.

```bash
yarn setup                                  # install root, backend and frontend
yarn db:up                                  # PostgreSQL 16 on localhost:5433
cp backend/.env.template backend/.env       # set JWT_SECRET, the first admin (ADMIN_*), and VAPID keys
yarn dev                                    # API on :8790, app on http://localhost:5190
```

Reminders need VAPID keys in `backend/.env` (`npx web-push generate-vapid-keys`). Without them the
app works and simply doesn't offer notifications.

The first admin is created on start from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when there is no admin
yet, or any time with:

```bash
yarn create-admin --email you@example.com --name Cristian --surname Brinza
```

To try it on a phone or iPad on the same Wi-Fi: `yarn --cwd frontend dev:lan` and open the
"Network" address. "Add to Home Screen" works there too.

## Checks

```bash
yarn verify       # typecheck, lint, tests and production builds of both apps
```

- Backend tests run against a real PostgreSQL (`lms_test` on the `yarn db:up` server, created
  automatically, or `TEST_DATABASE_URL`).
- The frontend typecheck is `tsc -b` (`yarn --cwd frontend typecheck`). `tsc --noEmit -p .` checks
  nothing there.
- A frontend test fails if any food or kitchenware icon the API knows has no SVG.

## Growing the catalog

- **Foods:** `backend/src/modules/food/presets.ts`.
  - `RAW_PRESETS`: name, icon, kind, unit, place, keeping days, piece size, aliases.
  - `EXTRA`: packages and their usual sizes, kinds.
  - `OPENED`: days once opened.
  - When existing kitchens should get the change (new packages, kinds, keeping times), bump
    `CATALOG_VERSION`. Each kitchen is brought up to it once, without changing how its items are
    counted.
- **Icons:** draw a 48×48 SVG in `frontend/src/food/icons/svg/<key>.svg` (flat fills, ink outline
  `var(--color-ink-900)`), then add the key to `FOOD_ICONS` (or `TOOL_ICONS` in `kitchenware.ts`).
- **Kitchenware:** `TOOL_PRESETS` in `backend/src/modules/food/kitchenware.ts`.

## Deploy

Production runs on an always-on Windows PC (WSL + Docker Desktop) behind a Cloudflare Tunnel, with
the web app on Cloudflare Workers. A push to `main` deploys itself:

1. GitHub Actions runs every check.
2. It publishes the API image.
3. The PC's updater backs up, switches and health-checks, and rolls back on its own if needed.
4. CI publishes the matching web app once the API runs it.

**Everything about it is in [docs/production.md](docs/production.md)**: the one-time setup on GitHub,
Cloudflare and the PC (`deploy/server/setup.sh`), hiding the API behind Cloudflare Access, Claude
working on production data, backups, restores and what to do when something is off.
`deploy/test/e2e.sh` tests the whole pipeline on local Docker.

`yarn deploy` still exists for a one-off from a dev machine:

```bash
yarn deploy web          # only the web app (Worker + assets)
yarn deploy secrets      # the Worker's keys: PROXY_SECRET and the Access service token
yarn deploy verify       # the live checks (also: yarn deploy:verify)
yarn deploy api          # the API stack built here (not how production updates)
```

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
- Access keys for Claude are separate. Each has a scope, is stored hashed, is shown once and can be
  revoked in Settings.

## Adding a life area

Areas live in `frontend/src/areas/registry.ts`. Food (`to: '/food'`) and Training
(`to: '/training'`) have their screens; an entry without `to` is a tile only, and a tap says it's
being built. To give an area its screen:

1. Build the page.
2. Add its route in `frontend/src/app/router.tsx`.
3. Set `to` on its registry entry; the tile becomes a link.

A new area is one more registry entry; the dashboard grid takes 10+.

## Brand

The logo is `frontend/brand/logo.svg`. Icons, the favicon and the iOS launch screens are
generated from it on every build (`yarn --cwd frontend brand` forces it). Red lives in the logo
only. The interface uses the fixed LMS palette (lavender field, ink, butter, cyan, pastels) with
flat surfaces and soft shadows.
