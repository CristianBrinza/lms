import { Hono, type Context } from 'hono';
import { mcpChallenge } from '../oauth';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { enforceRateLimits } from '../../lib/rate-limit';
import { bearerToken } from '../../middleware/auth';
import { ensureKitchen, foodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { publishChange, toolArea } from '../live/publish';
import { authenticateToken, BRIDGE_SCOPE, type TokenScope } from '../tokens';
import { inputSchema, scopeAllows, TOOLS, type ToolEnv } from './tools';

/**
 * LMS over MCP (Model Context Protocol), so Claude can run the kitchen: Streamable HTTP in its
 * stateless form — every POST carries one JSON-RPC message (or a batch) and gets JSON back; there
 * is no session and no event stream. Authentication is an AI access key, in the Authorization
 * header or, for clients that only take a URL (claude.ai connectors), in the path:
 * /api/mcp/k/<key>. The key's scope decides which tools exist for it.
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_VERSION = '1.0.0';

export const INSTRUCTIONS = `LMS: this household's food — what is in the kitchen, recipes, shopping lists per store, the meal plan — everyone's home training, the family's trips, and the films and series each person watches. The data is real and shared by the family: be accurate, careful and brief.

How it works
- Items are counted in a base unit: pcs, g or ml. Amounts may be given in pcs, g, kg, ml, l, tsp, tbsp or cup; pieces convert through an item's piece size (a tomato ≈ 120 g).
- Names resolve loosely ("tomato" = Tomatoes; Romanian and Russian shop names work too). An unknown name creates a new item, so reuse the names you see in list_stock / find_items.
- Icons: every item, recipe and piece of kitchenware has its own drawing, one per kind (Coca-Cola Zero is a black can). After add_stock or save_item with a new kind of thing, check list_icons; if no built-in icon fits, draw one with create_icon (it is usable at once) and set it with save_item (icon: "custom:…"). Reuse the kitchen's own icons before drawing another.
- Items have their own units too (a jar of pickles = 12, a cake = 8 pieces, a can of Coca-Cola = 330 ml); when one holds a different amount this time, pass each (a jar of 14: quantity 1, unit "jar", each 14).
- Types (variant): "apple juice" is Juice, type Apple; "Coca-Cola Zero" is Coca-Cola, type Zero; "Borjomi" is Mineral water, type Borjomi. A new type is remembered the first time it is used, so name new drinks, juices or flavours freely.
- Packages: a jar, bottle, loaf or can says what it holds. add_stock with packages: [{ count, size, sizeUnit }] makes one lot per size (one 1 l bottle and two of 0.5 l; ice cubes in a pack of 3 and one of 4). Bread counts in slices, a loaf being its package.
- Shopping lines ask for at least an amount. When ticking, record what was really bought (bought: packages); checkout keeps the rest on the list when less was bought.
- An ingredient can ask for one type (variant "Finlandia"), and only that type counts; otherwise any type does.
- An ingredient can have alternatives (or: [{ name: "Whipped cream" }]). Each line shows every option and whether there is enough (alternatives[].enough, mainEnough). A planned meal can pick one (pick_option); unpicked, the first there is enough of is used. cook_recipe takes choices by ingredient position and refuses when a picked option isn't there.
- Weighed and poured things convert at about 1 g per ml (300 g of milk ≈ 300 ml) for dairy, drinks, sauces and pantry; spoons and cups work for anything weighed.
- Real portions: coffee is weighed (about 10 g a cup; 20 g of beans and 300 g of milk make two lattes); a recipe for drinks is a recipe like any other (tags: drink).
- pour moves some of one lot into another (the big oil bottle into the small one on the desk).
- A meal can have several parts (add_meal_part): a dish, sides, sauces, drinks, each from a recipe or named with its own ingredients.
- Courses: a meal is made of sections — first course, second (dish), side, sauce, dessert, drinks — any of them (just a coffee is drinks only). A meal part's kind is its course; a recipe of several courses gives each ingredient and each choice its course (breakfast: eggs on toast in dish, the coffee-or-tea choice in drink).
- A recipe can have choices: a part made one way or another, several ingredients at once (breakfast's Drink: creamy coffee or tea), each option with its own ingredients and steps (save_recipe choices). Planning or cooking takes the option named (options: ["Tea"]), else the one picked last time, else the first; only its ingredients are needed, bought, counted and taken. Switch a planned meal's option with choose_meal_option. One swapped item (milk or cream) stays an ingredient's or.
- An optional line of a planned meal can be switched on or off for that meal (include_ingredient): off, it is left out of the shopping, nutrition and what cooking takes.
- Opening a package (or cooking part of it) shortens its expiry and moves it where it belongs once open; complete_meal reports what it opened — suggest using those soon.
- Kitchenware (list_kitchenware): pots, pans, glasses, even pens, with clean / dirty / in the dishwasher. Recipes list the kitchenware they need (tools); cooking makes it dirty; wash_kitchenware by hand or machine. Warn when a planned meal's kitchenware is dirty.
- Stock is kept as lots: each steak or package is its own lot with its own expiry. Using stock takes the lot you name, else opened lots first, then the soonest to expire.
- Spices, sauces, oil and similar are kept by level instead (trackedBy: level): full, half (medium), low or out — set it with set_level; they are never weighed or deducted. Buying one makes it full again.
- Moving a lot to the freezer (update_lot location: freezer) resets its expiry to the item's frozen days; taking it out gives it the thawed days.
- A meal copies its recipe's ingredients, scaled to its servings; change them for that day with update_meal (e.g. pick a lotId). complete_meal takes them from the kitchen and can keep leftovers; reopen_meal undoes it.
- plan_needs says what to buy for planned meals, minus stock and what is already listed. Add those lines with add_to_shopping_list (source "plan"), to each item's usual store unless told otherwise.
- Dates are YYYY-MM-DD and times HH:MM, local to the kitchen (Europe/Chisinau). Prices are in lei (MDL).

Travel (the household's trips)
- travel_overview first: trips (upcoming first), bags and the packing list with its rules. plan_trip makes a trip and its checklist from those rules (national/international, kind, transport, days, who goes); overrides switch single items on or off for one trip; add_trip_item adds something for that trip only; add_packing_item teaches the list for all trips. Dates are local (YYYY-MM-DD), times HH:MM.

Watching (films and series, each person's own; from TMDB)
- Titles are "movie:<tmdb id>" or "tv:<tmdb id>"; find them with watching_search. watching_overview shows what someone is in the middle of, their watchlist and what airs soon; watching_title the details, progress and where to watch.
- Plays: watching_mark_watched for a film or one episode, watching_mark_up_to for many (up to S3E5, a season, the whole show). Backfill with watchedAt as a day, a month ("2025-03") or "unknown" when they don't remember. people: who watched — several names means they watched together.
- Before recommending a title, verify on the web that it is actually available in Moldova (MD) on that service — many lists claim Netflix or Prime titles that aren't offered here — then record what you found with watching_set_availability (provider, available, a note with how you checked). TMDB's where-to-watch for MD (or RO, flagged needsChecking) is a starting point, not proof.
- Suggestions: watching_similar (for a title, or "because you watched" without one) and watching_discover (trending, or by genre/year/provider); skip what is already in their library, and respect their ratings. watching_add_to_list keeps ideas in a named list ("Movie night").
- watching_stats for screen time and a year in review; watching_calendar for what airs when; watching_import brings small TV Time or Trakt export files over (big ones go through the app).

Priority buy list (bigger things to buy one day, in order)
- buy_list first: what's wanted, in priority order (rank 1 first), with urgency (now, soon, someday), price, link, note; bought ones after. buy_list_add for something new ("a cordless vacuum", "a monitor"): put a real price and a shop link when you find them, top: true when it should come first. buy_list_update to change it, reorder (position), or mark it bought (status bought, boughtPrice). Groceries go on the shopping list, not here.

Drinks (the household's cellar and everyone's tasting journal: wine, sparkling, spirits, beer…)
- A drink is one specific version: "Jack Daniel's" is the line, "Tennessee Honey" the variant; a wine's each vintage is its own drink. drinks_list first (search by name, producer, region…), so a known bottle gets a tasting or stock rather than a duplicate; drinks_add with fromId makes a new version of the same line.
- From label photos: read everything the labels say into drinks_add (name as on the label, producer, line, variant, vintage, age, ABV, volume, country as an ISO code, region, appellation, grapes, style, cask, the back label's text in labelText as written), then drinks_add_photo with each photo (front first, then kind "back"). Never guess facts the labels don't show.
- drinks_add_tasting: who (person, default you), when, where (place, country), stars as rating 1–10 in half stars (9 = 4.5 stars), comment, pairing, buyAgain; a structured sheet (WSET-style for wine and spirits, BJCP scores for beer) only when they described it. drinks_set_stock for bottles at home (delta +1 bought, −1 finished), where they are, open or not.

Closet (each person's clothes, shoes, bags and jewellery; the household sees each other's)
- closet_list first (person: a name, default you; "all" for the household), so a known piece gets a photo or an update instead of a duplicate.
- From photos in a chat: closet_add_item with what the photos show (name, category and subcategory, colours, brand, size), person and place when said, then closet_add_photo with each photo — the piece itself as kind front (then back, detail), its care label as kind "label". Front and back photos keep their background and are marked needsCutout: the app removes it in the browser with one tap; never refuse a photo for its background.
- A care label: read it into closet_set_care — care symbols (wash method and temperature with gentle bars, bleach, tumble dry, natural drying, iron temperature, steam, professional cleaning), materials with %, size and size system, brand, made in, the rest as labelText — and write storageAdvice from the materials. Never guess a symbol the label doesn't show.
- Places are the household's: closet_places lists them as paths and creates rooms, furniture in rooms, and sections in furniture (shelf 1 is the lowest; drawers from the top; rails, boxes, hooks). closet_set_place moves pieces ("Bedroom > Wardrobe > Shelf 2 left"), with how they're kept (folded, hanging, drawer, box).
- closet_log_worn when someone says what they wore (it adds up to cost per wear); closet_update_item status to_wash, lent (lentTo), wishlist, archived, sold, donated.

Medication (the household's medicine cabinet, treatments and doses taken)
- medication_list first (q, filter expiring/expired/low), so a known medicine gets a new package instead of a duplicate. Informational only: no advice, no interaction checks; say "Informativ; întreabă medicul sau farmacistul" when asked about use.
- From photos of boxes, blisters and bottles: medication_add_medicine (name, active substance, strength, form, rx as printed), medication_add_photo with each photo, then medication_add_package with batch, expiry (YYYY-MM-DD, or YYYY-MM when only the month is printed), place and the count left. Ask the person to count only when the number isn't visible. Never guess what the photos don't show.
- medication_add_treatment for a person (dose, times or every N hours or prn, start and end, instructions); medication_log_dose when someone says they took, skipped or un-took a dose (it counts out of the package that expires first); medication_expiring for what needs a look; throw expired packages away with medication_update_package status discarded. Never put a medicine on the buy list unless asked.

Training (home workouts, each person's own)
- training_overview first: whose (userId; default you), today's and next workouts, the week, streaks. People are the household's, with gender, age and height: "for Maria" means her userId. Each person has their own exercise library and routines (exercise ids differ per person; plan_workout maps another person's to theirs); the equipment is shared.
- Equipment pieces: bands each with a resistance (kg), the bar's grips. An exercise's options are its variations plus those pieces; plan items and sets take variant ("Wide grip", "Black band").
- The household trains at home with what training_equipment lists. list_exercises says which exercises that allows (available) and the weights owned (kg, pair or single); never plan an exercise that isn't available.
- plan_workout: exercises in order with sets and a target — reps (weight in kg if weighted), seconds, or distance in metres; rest in seconds. rounds > 1 makes a circuit of the main block; warm-up/cool-down items (block) are done once. suggest_workout makes one up for minutes, focus, level and quiet (no jumping).
- log_exercise records sets: during a workout (workoutId) or on their own — "I did 10 push-ups" is a set now; "20 squats yesterday" is day only. It reports new personal bests.
- Nutrition: items carry kcal, protein, fat, carbs per 100 g / 100 ml / piece (the catalog's typical values, or the household's own: set_nutrition, from a label or a web search — say where the numbers came from). Recipes and meals show per-serving values. log_food records something eaten outside the plan for whoever ate it.
- Energy (energy_summary): eaten vs burned per person and day — resting and active energy from the phone, else Mifflin–St Jeor and the activity level; training from Compendium METs × weight × time. The target follows the goal (set_goal: lose/keep/gain, kg a week). Suggest meals and training that close the gap; never promise medical outcomes.
- Health (health_summary): steps, sleep, resting heart rate, weight… from the phone's health app. Use it to adjust plans (a short night or a raised resting heart rate: go easier). Observations, never diagnoses.
- Progress: workouts show last time's sets and a suggestion (one more rep; a heavier owned weight when well past the target). training_stats for weeks and months.

Languages (English, Romanian, Russian)
- The family reads LMS in English, Romanian or Russian. Always write names, steps and notes in English, Romanian and Russian: the base text in the language Cristian used, and translations with the other two (and en). Use natural Moldovan Romanian with diacritics (ă, â, î, ș, ț) and natural Russian, the words shops here use (smântână / сметана, Linella, lei).
- Example: Cristian writes "Plăcinte cu brânză". save_recipe gets title "Plăcinte cu brânză", steps in Romanian, and translations { "en": { "title": "Cheese pies", "steps": ["Knead the dough", …] }, "ro": { "title": "Plăcinte cu brânză", "steps": [ … ] }, "ru": { "title": "Плацинды с брынзой", "steps": ["Замесите тесто", …] } }.
- Records come back with their translations; fill in a language that is missing when you change one. Item names in ingredients and shopping lines stay the kitchen item's base name, so they match.
- An item's kinds (variants) are translated by kind in its translations, with save_item or add_stock: { "ro": { "variants": { "Greek 2%": "Grecesc 2%" } }, "ru": { "variants": { "Greek 2%": "Греческий 2%" } } }. Brands that read the same everywhere need nothing.

Good habits
- Start with kitchen_overview and kitchen_people. Never plan or suggest a dish with something someone is allergic to; avoid what people don't eat unless asked.
- Cook what expires first; plan meals that use it. Food a planned meal has claimed shows as reservedFor.
- Shopping lines can have needBy (the meal's day, so it's bought the day before) and priority.
- Batch: add many stock entries or list lines in one call.
- Recipes: every ingredient with the kitchen item's name, an amount and a unit; leave the amount out for "to taste"; link: false for tap water. Steps short and imperative.
- Before deleting, or marking meals eaten for someone, say what you will do unless they asked plainly.
- Reply with what changed, what is missing and what to buy — not the raw data.`;

interface Prompt {
  name: string;
  title: string;
  description: string;
  arguments: Array<{ name: string; description: string; required?: boolean }>;
  text: (args: Record<string, string>, today: string) => string;
}

const PROMPTS: Prompt[] = [
  {
    name: 'plan_week',
    title: 'Plan the week',
    description:
      'Plan the coming week’s meals from what is in the kitchen, then list what to buy per store.',
    arguments: [
      { name: 'start', description: 'First day (YYYY-MM-DD); default today' },
      { name: 'people', description: 'How many people eat' },
      { name: 'wishes', description: 'Anything to keep in mind (diet, busy days, favourites)' },
    ],
    text: (a, today) =>
      `Plan meals for the 7 days from ${a.start || today}${a.people ? ` for ${a.people} people` : ''}. Look at the kitchen first and use what expires soonest. Use my recipes where they fit; save new recipes for anything new you suggest. Put breakfast, lunch and dinner on the plan with sensible times. Then run plan_needs for those days and add what to buy to the right store lists. ${a.wishes ? `Keep in mind: ${a.wishes}. ` : ''}Finish with a short summary per day and the shopping per store.`,
  },
  {
    name: 'use_it_up',
    title: 'Use it up',
    description: 'Meals for the food that expires in the next few days.',
    arguments: [],
    text: (_a, today) =>
      `Today is ${today}. Find everything in the kitchen that expires within 3 days (or already has) and suggest meals that use it, from my recipes first. Ask before planning them.`,
  },
  {
    name: 'shop_for_month',
    title: 'Shop for a month',
    description: 'Plan a month of meals and build the shopping lists per store.',
    arguments: [
      { name: 'month', description: 'YYYY-MM; default next 30 days' },
      {
        name: 'stores',
        description: 'Which stores to use, e.g. “Metro for bulk, Linella for fresh”',
      },
    ],
    text: (a, today) =>
      `Plan meals for ${a.month ? `the month ${a.month}` : `the 30 days from ${today}`}, reusing my recipes with variety (no dish more than twice a week). Then work out what to buy with plan_needs and split it across stores${a.stores ? ` (${a.stores})` : ''}: long-keeping and bulk items in one big shop, fresh food closer to when it is needed. Add everything to the lists and summarise per store.`,
  },
  {
    name: 'save_recipe_from',
    title: 'Save a recipe',
    description: 'Turn a link or pasted text into a recipe linked to the kitchen.',
    arguments: [{ name: 'source', description: 'A link or the recipe text', required: true }],
    text: (a) =>
      `Save this as a recipe: ${a.source}\nUse my kitchen's item names for ingredients (check find_items), with amounts and units; set servings, times, tags and short steps. Write it in English, Romanian and Russian (the base text in my language, translations with the rest). Tell me what is missing from the kitchen to cook it.`,
  },
];

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

const ok = (id: JsonRpcId, result: unknown) => ({ jsonrpc: '2.0', id, result });
const fail = (id: JsonRpcId, code: number, message: string, data?: unknown) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message, ...(data ? { data } : {}) },
});

export function mcpRoutes(deps: AppDeps, getApp: () => Hono<AppEnv>) {
  const app = new Hono<AppEnv>();

  const handle = async (c: Context<AppEnv>, raw: string | null) => {
    if (!raw)
      throw new AppError(
        401,
        'KEY_REQUIRED',
        'Sign in to LMS, or use an access key (Settings → Claude access)',
        { headers: { 'WWW-Authenticate': mcpChallenge(deps) } },
      );
    const auth = await authenticateToken(deps, raw);
    if (!auth)
      throw new AppError(401, 'KEY_INVALID', 'This access key is not valid', {
        headers: { 'WWW-Authenticate': mcpChallenge(deps, 'invalid_token') },
      });
    if (auth.scope === BRIDGE_SCOPE)
      throw new AppError(403, 'KEY_SCOPE', 'This access key can’t do that');
    await enforceRateLimits(deps, [{ key: `mcp:${auth.tokenId}`, limit: 600, windowSec: 10 * 60 }]);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(fail(null, -32700, 'Parse error'), 400);
    }

    const kitchen = await ensureKitchen(deps, auth.user);
    const actor = {
      householdId: kitchen.id,
      userId: auth.user.id,
      via: 'ai' as const,
      currency: kitchen.currency,
    };
    const env: ToolEnv = {
      ctx: foodCtx(deps, actor),
      deps,
      locale: auth.user.locale ?? 'en',
      internal: async (method, path, payload) => {
        const headers: Record<string, string> = { authorization: `Bearer ${raw}` };
        if (payload !== undefined) headers['content-type'] = 'application/json';
        const res = await getApp().request(path, {
          method,
          headers,
          body: payload === undefined ? undefined : JSON.stringify(payload),
        });
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        if (res.status >= 400)
          throw new AppError(
            res.status,
            parsed?.error?.code ?? 'ERROR',
            parsed?.error?.message ?? 'Request failed',
            { fields: parsed?.error?.fields },
          );
        return { status: res.status, body: parsed };
      },
    };

    const messages = Array.isArray(body) ? body : [body];
    const replies = [];
    for (const message of messages) {
      const reply = await dispatch(message as JsonRpcRequest, auth.scope, env);
      if (reply) replies.push(reply);
      announceWrite(deps, message as JsonRpcRequest, reply, auth.user.id, kitchen.id);
    }
    if (!replies.length) return c.body(null, 202);
    return c.json(Array.isArray(body) ? replies : replies[0]);
  };

  app.post('/', (c) => handle(c, bearerToken(c.req.header('authorization'))));
  app.post('/k/:key', (c) => handle(c, c.req.param('key')));
  // Stateless: no event stream to open and no session to end.
  const notAllowed = (c: Context<AppEnv>) =>
    c.json(fail(null, -32000, 'Method not allowed: POST JSON-RPC messages'), 405, {
      Allow: 'POST',
    });
  app.get('/', notAllowed);
  app.get('/k/:key', notAllowed);
  app.delete('/', notAllowed);
  app.delete('/k/:key', notAllowed);
  return app;
}

async function dispatch(message: JsonRpcRequest, scope: TokenScope, env: ToolEnv) {
  if (
    !message ||
    typeof message !== 'object' ||
    message.jsonrpc !== '2.0' ||
    typeof message.method !== 'string'
  ) {
    return fail(message?.id ?? null, -32600, 'Invalid request');
  }
  const { id = null, method, params = {} } = message;
  const isNotification = message.id === undefined;
  if (isNotification) return null;

  const tools = TOOLS.filter((tool) => scopeAllows(scope, tool.access));
  switch (method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      return ok(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: 'lms-kitchen', title: 'LMS Kitchen', version: SERVER_VERSION },
        instructions:
          INSTRUCTIONS +
          (scope === 'food:read'
            ? '\n\nThis key can only read: suggest changes, the person makes them in the app.'
            : ''),
      });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, {
        tools: tools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: inputSchema(tool.input),
          annotations: {
            title: tool.title,
            readOnlyHint: tool.access === 'read',
            destructiveHint: Boolean(tool.destructive),
            openWorldHint: false,
          },
        })),
      });
    case 'tools/call': {
      const name = String(params.name ?? '');
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${name}`);
      if (!scopeAllows(scope, tool.access))
        return ok(
          id,
          toolError(
            `This key can’t use ${name}: it needs ${tool.access === 'admin' ? 'admin' : 'kitchen'} access`,
          ),
        );
      const parsed = tool.input.safeParse(params.arguments ?? {});
      if (!parsed.success) {
        const fields = Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.') || 'arguments', issue.message]),
        );
        return ok(id, toolError(`Some arguments need attention: ${JSON.stringify(fields)}`));
      }
      try {
        const result = await tool.run(
          { ...env, ctx: { ...env.ctx, now: env.deps.now() } },
          parsed.data,
        );
        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(result ?? { ok: true }) }],
        });
      } catch (error) {
        if (error instanceof AppError)
          return ok(
            id,
            toolError(
              error.fields ? `${error.message}: ${JSON.stringify(error.fields)}` : error.message,
            ),
          );
        console.error(`[mcp] ${name} failed`, error);
        return ok(id, toolError('Something went wrong on the server'));
      }
    }
    case 'prompts/list':
      return ok(id, {
        prompts: PROMPTS.map(({ name, title, description, arguments: args }) => ({
          name,
          title,
          description,
          arguments: args,
        })),
      });
    case 'prompts/get': {
      const prompt = PROMPTS.find((p) => p.name === params.name);
      if (!prompt) return fail(id, -32602, `Unknown prompt: ${String(params.name)}`);
      const args = (params.arguments ?? {}) as Record<string, string>;
      return ok(id, {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: prompt.text(args, localDate(env.deps.now())) },
          },
        ],
      });
    }
    case 'resources/list':
      return ok(id, { resources: [] });
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * Live sync for what Claude changed: a tool that writes and worked is announced to the
 * household, like a change made in the app. (Tools that go through the API are announced there
 * too; the app folds the two into one refresh.)
 */
function announceWrite(
  deps: AppDeps,
  message: JsonRpcRequest,
  reply: unknown,
  userId: string,
  householdId: string,
): void {
  if (message?.method !== 'tools/call') return;
  const name = String(message.params?.name ?? '');
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool || tool.access === 'read') return;
  const result = (reply as { result?: { isError?: boolean } } | null)?.result;
  if (!result || result.isError) return;
  publishChange(deps, { area: toolArea(name), path: `/api/mcp/${name}`, userId, householdId });
}

const toolError = (text: string) => ({ content: [{ type: 'text', text }], isError: true });
