---
name: lms-production
description: Use when Cristian asks to change or look at LMS data in production (the live app at lms.shades.md) — add food to the kitchen, write or change a recipe, plan meals or a week, fill shopping lists, set allergies, count kitchenware, plan or log workouts and home equipment — or to check that production is up and which version runs. Not for changing the app's code (a normal commit: pushed to main it goes live from the PC; on the PC itself, lms-server's live.sh).
---

# Working on production LMS data

Production is the live app at **https://lms.shades.md**: the web app, the API and the database
all run on the always-on Windows PC, behind a Cloudflare Tunnel. For data, Claude never touches
the database directly: it works through the app's public address with an **access
key**, under the same rules as the app (the key's owner's kitchen, the key's scope).

## How to reach it

1. **MCP (preferred)** — if a server named `lms` is connected, use its tools (kitchen_overview,
   add_stock, save_recipe, plan_meal, add_meal_part, plan_needs, add_to_shopping_list,
   list_kitchenware, …; for training: training_overview, list_exercises, plan_workout,
   suggest_workout, log_exercise, training_stats). Its instructions explain packages, kinds,
   alternatives, the plan and training.
2. **CLI** — otherwise `node scripts/lms.mjs` from the repo root:
   - `node scripts/lms.mjs whoami` — confirm the address, the user and the kitchen first
   - `node scripts/lms.mjs GET /api/food/overview?today=YYYY-MM-DD`
   - `node scripts/lms.mjs POST /api/food/stock '{"name":"Milk","packages":[{"count":2,"size":1,"sizeUnit":"l"}]}'`
   - routes: `backend/src/modules/food/routes.ts`; bodies: `backend/src/modules/food/schemas.ts`
   - training: `/api/training/...` — `backend/src/modules/training/routes.ts` and `schemas.ts`
     (e.g. `POST /api/training/sets '{"exerciseId":"…","reps":10}'`)
3. **No key yet** — tell Cristian: in the app, Settings → Claude access → new key (scope
   "Kitchen"), then in a terminal `node scripts/lms.mjs login`, or connect MCP:
   `claude mcp add --transport http --scope user lms https://lms.shades.md/api/mcp --header "Authorization: Bearer <key>"`.
   Never ask for the key in the chat, never print it, never write it into the repo.

## Rules

- Read before writing: look at what's there (kitchen, recipes, the plan's week) and reuse
  existing item names; don't create duplicates.
- Batch: many stock entries or list lines in one call.
- Say what you will change before deleting anything, marking meals eaten, or changing many
  things at once, unless Cristian asked for exactly that.
- Dates are the kitchen's local days (Europe/Chisinau); prices in lei.
- Real-life amounts: packages with their sizes, kinds (Finlandia, Cheddar), alternatives
  ("milk, or whipped cream"), meal parts (dish, side, sauce, drink), kitchenware the recipe needs
  (with "or" and "one each" for plates and lunch boxes).
- Afterwards, report what changed, what's missing, and what to buy — not raw JSON.
- `node scripts/lms.mjs health` shows the live web and API versions (after a deploy: is the new
  version live?).

## When something is wrong in production

`node scripts/lms.mjs health` first. The API being down usually means the PC is off, asleep, or
Docker isn't running; the fix is on that PC (`deploy/server/status.sh` there, docs/production.md).
