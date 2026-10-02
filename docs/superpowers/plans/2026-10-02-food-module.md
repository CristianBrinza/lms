# Food Module Implementation Plan

> **For agentic workers:** Execute phase by phase (superpowers:executing-plans). Each phase ends green
> (`yarn verify`) and in its own commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Food tile into one connected system: kitchen inventory, recipes, shopping lists
per store, and a meal plan, all reading from and writing to the same stock, and managed by people
in the app or by Claude through an access key.

**Architecture:** One `food` backend module with a service layer (`modules/food/*.ts`) that both the
REST routes (`/api/food/*`) and an MCP endpoint (`/api/mcp`) call, so the app and the AI share every
rule. All food data belongs to a **kitchen** (household); a person belongs to one kitchen, created
on first use, and the admin can seat people in the same kitchen. The frontend adds a lazy `/food`
route tree with four sections and a set of drawn food icons.

**Tech Stack:** Hono + pg + zod 4 (`z.toJSONSchema` for MCP tool schemas), vitest on real
Postgres; React 19, React Router 8, TanStack Query 5, Tailwind 4 tokens, MUI Rounded icons.

## Global Constraints

- Palette is fixed (lavender field, ink, butter, cyan, pastels); surfaces flat, soft shadows only;
  red stays in the logo (food illustrations may use natural food colours, muted, flat).
- No raw hex in components: tokens only (icon artwork files are the one exception).
- English copy, short and plain; quantities read the way people say them ("1.3 kg", "2 tomatoes").
- Mobile first; desktop gets real layouts (multi-column), not stretched phone screens.
- Every list has loading (skeleton), empty (what to do next) and error (retry) states.
- Never trust the client for kitchen membership: every query is scoped by the caller's kitchen.
- Commits: no AI attribution lines. Backend is not deployed until Cristian says so.
- Currency MDL by default, shown as "45.50 lei".

---

## Domain model (migration 2)

| Table | Purpose | Key columns |
|---|---|---|
| `households` | a kitchen | `name`, `currency` (MDL) |
| `users.household_id` | membership | nullable; set lazily on first food request |
| `products` | catalog of things you keep | `name`, `icon`, `category`, `unit` (`pcs`/`g`/`ml`), `piece_size` + `piece_unit` (one piece in g/ml), `location` default, `shelf_life_days`, `min_stock`, `store_id` default, `archived_at` |
| `stock_lots` | one physical batch (each steak is a lot) | `quantity` remaining (base unit), `initial_quantity`, `location`, `added_at`, `expires_at` (date), `opened_at`, `price`, `store_id`, `trip_id`, `note`, `finished_at` |
| `stock_events` | history | `kind` added/used/wasted/adjusted/moved, `quantity`, `lot_id`, `meal_id`, `actor_id`, `via` app/ai |
| `stores` | Linella, Metro… | `name`, `tone`, `sort`, `archived_at` |
| `shopping_items` | a line on a store's list | `store_id` (null = any store), `product_id`, `name`, `quantity`+`unit`, `checked_at`, `price` (line total), `trip_id` (set at checkout), `source` manual/plan/low_stock/ai |
| `shopping_trips` | a finished shop | `store_id`, `total`, `item_count`, `finished_at` |
| `recipes` | `title`, `description`, `servings`, `prep_minutes`, `cook_minutes`, `tags[]`, `steps[]`, `icon`, `source_url`, `favorite`, `created_via` |
| `recipe_ingredients` | `product_id` (null = untracked, e.g. "salt to taste"), `name`, `quantity` (base), `unit` (display), `note`, `optional`, `sort` |
| `meals` | a planned meal | `date`, `time`, `slot`, `recipe_id`, `title`, `servings`, `status` planned/done/skipped, `done_at` |
| `meal_ingredients` | per-meal copy of the recipe's ingredients, editable (swap a tomato, pick the 2 kg steak) | `product_id`, `lot_id`, `quantity`, `unit` |
| `api_tokens` | AI access keys | `user_id`, `name`, `token_hash`, `prefix`, `scope` food:read/food/admin, `last_used_at`, `revoked_at` |

**Units.** Stored in the product's base unit (`pcs`, `g`, `ml`). Input accepts `pcs g kg ml l tsp
tbsp cup`; pieces convert to weight/volume through `piece_size`. Incompatible units answer 400.

**Using stock.** Specific lot if given, else first-expiring-first (FIFO by `expires_at`, then
`added_at`). Shortfalls are reported, never negative stock. Every change writes a `stock_events` row.

**Meals.** Planning from a recipe copies its ingredients scaled to servings. Marking done deducts
them (chosen lot or FIFO), optionally saves leftovers as a stock lot; reopening a done meal puts the
exact quantities back (undo).

**Plan → shopping.** Needs for a date range = planned meals' ingredients − stock − what is already
on a list, grouped by the product's default store; previewed, then added in bulk.

**Shopping → kitchen.** Checkout turns checked items into stock lots (price, store, expiry from shelf
life), records a trip with its total, and leaves unchecked items on the list. Trip lines stay
editable later (price/quantity), which updates the lot.

## API surface

```
GET    /api/food/overview                     dashboard numbers, expiring, low stock, today's meals
GET    /api/food/presets                      built-in catalog (name, icon, category, unit, shelf life)
GET    /api/food/products?q=                  catalog search
POST   /api/food/products                     create (name resolves to preset defaults)
PATCH  /api/food/products/:id                 edit
DELETE /api/food/products/:id                 archive
GET    /api/food/kitchen?location=            products with active lots + totals
GET    /api/food/products/:id                 product + lots + recent events + last prices
POST   /api/food/stock                        add a lot {product|name, quantity, unit, location, expiresAt, price, storeId}
POST   /api/food/stock/use                    {productId, quantity, unit, lotId?, wasted?}
PATCH  /api/food/lots/:id                     quantity/location/expiry/opened/note
DELETE /api/food/lots/:id                     remove a mistaken lot
GET    /api/food/stores · POST · PATCH /:id · DELETE /:id
GET    /api/food/shopping?storeId=            active items (+ last price hints)
POST   /api/food/shopping/items               one or many items
PATCH  /api/food/shopping/items/:id           check/uncheck, quantity, price, store
DELETE /api/food/shopping/items/:id
POST   /api/food/shopping/checkout            {storeId, lines:[{id, price?, quantity?, expiresAt?, location?}]}
GET    /api/food/shopping/trips · GET /trips/:id · PATCH /trips/:tripId/items/:id
GET    /api/food/recipes?q=&ready= · GET /:id · POST · PUT /:id · DELETE /:id · POST /:id/favorite
GET    /api/food/meals?from=&to= · POST · PATCH /:id · DELETE /:id
PUT    /api/food/meals/:id/ingredients
POST   /api/food/meals/:id/done {leftovers?} · POST /api/food/meals/:id/reopen
GET    /api/food/plan/needs?from=&to= · POST /api/food/plan/needs  (add chosen lines to lists)
GET    /api/me/tokens · POST · DELETE /:id   AI access keys
POST   /api/mcp  ·  POST /api/mcp/k/:token    MCP (JSON-RPC, stateless) for Claude
GET    /api/admin/households · PATCH /api/admin/users/:id {householdId}
```

## Phases

### Phase 1 — Kitchen core (backend)
- [ ] `modules/food/units.ts` + tests (conversions, mismatch errors, display amounts)
- [ ] Migration 2 (all tables above), test TRUNCATE list updated
- [ ] `modules/food/kitchen.ts` (household resolution `requireKitchen`), `presets.ts`
- [ ] `products.ts`, `stock.ts` services + routes; tests: add lots, FIFO use across lots, lot use,
      waste, shortfall, kitchen isolation between households, expiry ordering
- [ ] Commit `feat(food): kitchen inventory API`

### Phase 2 — Stores and shopping (backend)
- [ ] `stores.ts`, `shopping.ts` services + routes; tests: add by name resolves product, check,
      checkout creates lots + trip + keeps unchecked, edit trip line updates lot price
- [ ] Commit `feat(food): stores, lists and checkout API`

### Phase 3 — Recipes and meal plan (backend)
- [ ] `recipes.ts` (availability per recipe), `meals.ts` (plan from recipe, edit ingredients, done →
      deduct + leftovers, reopen → restore), `plan.ts` (needs − stock − lists)
- [ ] Tests for each rule above
- [ ] Commit `feat(food): recipes, meal plan and plan-to-list API`

### Phase 4 — AI access (backend)
- [ ] `api_tokens` service, bearer auth in `requireAuth`, scope guard, `via: 'ai'` attribution
- [ ] `modules/mcp/` JSON-RPC handler: initialize (with cooking instructions), tools/list,
      tools/call, prompts/list, prompts/get, ping; tools call the same services
- [ ] Admin households endpoints
- [ ] Tests: token auth/scope/revoke, MCP tools/list + a tools/call round trip, URL-token form
- [ ] Commit `feat: AI access keys and MCP endpoint`

### Phase 5 — Food home + Kitchen (frontend)
- [ ] Types + endpoints + query keys; `food/` feature folder; drawn `FoodIcon` set (60+ items)
- [ ] Shared: QuantityInput (stepper + unit), ExpiryPicker (quick chips), ProductPicker, LocationTabs
- [ ] `/food` dashboard (four section cards, today, use soon, running low)
- [ ] `/food/kitchen` (search, location tabs, product cards) + product sheet (lots, use, move, waste)
      + add flow; registry `to: '/food'`
- [ ] Commit

### Phase 6 — Shopping (frontend)
- [ ] Store tabs, add-item bar with suggestions, aisle grouping, check into cart, inline price,
      running total, finish-shopping review → kitchen, past trips with editable lines
- [ ] Commit

### Phase 7 — Recipes (frontend)
- [ ] List (search, ready-to-cook, favourites, tags), detail (servings scaler, have/missing,
      add missing to list, cook now, plan it), editor (ingredients + steps)
- [ ] Commit

### Phase 8 — Plan (frontend)
- [ ] Week view (day strip on phone, 7 columns on desktop), add meal, meal sheet (ingredients
      editor with lot choice, done with undo + leftovers, skip, swap), "Shop for these days"
- [ ] Commit

### Phase 9 — AI settings + docs
- [ ] Settings → AI assistant: create key with a role, copy once, Claude Code command, connector
      link, revoke; admin: kitchen membership on a person's page
- [ ] `docs/ai-assistant.md`, project skill `.claude/skills/lms-kitchen/SKILL.md`
- [ ] Commit

### Phase 10 — Verify and ship
- [ ] `yarn verify`, impeccable review + captures at 390/1024/1440, fix findings, commit
- [ ] Deploy the frontend; ask before deploying the backend
