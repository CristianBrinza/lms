import type { Database } from './index';

/**
 * Schema changes, applied in order on start and recorded in schema_migrations. Never edit a
 * migration that has shipped: add the next one. Kept in code (not .sql files) so the API ships
 * as one bundled file.
 */
export const MIGRATIONS: ReadonlyArray<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'users, sessions, rate limits, audit log',
    sql: `
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        email text NOT NULL,
        name text NOT NULL,
        surname text NOT NULL DEFAULT '',
        role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
        password_hash text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        must_change_password boolean NOT NULL DEFAULT false,
        token_version integer NOT NULL DEFAULT 0,
        last_login_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_email_key ON users (lower(email));

      CREATE TABLE sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        prev_token_hash text,
        rotated_at timestamptz,
        remember boolean NOT NULL,
        user_agent text NOT NULL DEFAULT '',
        ip text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz
      );
      CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;
      CREATE INDEX sessions_prev_token_idx ON sessions (prev_token_hash) WHERE prev_token_hash IS NOT NULL;
      CREATE INDEX sessions_expires_idx ON sessions (expires_at);

      CREATE TABLE rate_limits (
        key text PRIMARY KEY,
        count integer NOT NULL,
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX rate_limits_expires_idx ON rate_limits (expires_at);

      CREATE TABLE audit_log (
        id bigserial PRIMARY KEY,
        actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
        action text NOT NULL,
        target_id uuid REFERENCES users (id) ON DELETE SET NULL,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        ip text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
    `,
  },
  {
    version: 2,
    name: 'food: kitchens, products, stock, stores, shopping, recipes, meals; AI access keys',
    sql: `
      CREATE TABLE households (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        currency text NOT NULL DEFAULT 'MDL',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE users ADD COLUMN household_id uuid REFERENCES households (id) ON DELETE SET NULL;
      CREATE INDEX users_household_idx ON users (household_id);

      CREATE TABLE stores (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        name text NOT NULL,
        tone text NOT NULL DEFAULT 'butter',
        sort integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz
      );
      CREATE UNIQUE INDEX stores_name_key ON stores (household_id, lower(name));

      CREATE TABLE products (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        name text NOT NULL,
        icon text NOT NULL DEFAULT 'basket',
        category text NOT NULL DEFAULT 'other',
        unit text NOT NULL CHECK (unit IN ('pcs', 'g', 'ml')),
        piece_size numeric(12, 3) CHECK (piece_size > 0),
        piece_unit text CHECK (piece_unit IN ('g', 'ml')),
        location text NOT NULL DEFAULT 'pantry' CHECK (location IN ('fridge', 'freezer', 'pantry', 'other')),
        shelf_life_days integer CHECK (shelf_life_days > 0),
        min_stock numeric(12, 3) CHECK (min_stock >= 0),
        store_id uuid REFERENCES stores (id) ON DELETE SET NULL,
        note text NOT NULL DEFAULT '',
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz
      );
      CREATE UNIQUE INDEX products_name_key ON products (household_id, lower(name));

      CREATE TABLE shopping_trips (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        store_id uuid REFERENCES stores (id) ON DELETE SET NULL,
        store_name text NOT NULL DEFAULT '',
        total numeric(12, 2),
        item_count integer NOT NULL DEFAULT 0,
        finished_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL
      );
      CREATE INDEX shopping_trips_household_idx ON shopping_trips (household_id, finished_at DESC);

      CREATE TABLE stock_lots (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
        quantity numeric(12, 3) NOT NULL CHECK (quantity >= 0),
        initial_quantity numeric(12, 3) NOT NULL CHECK (initial_quantity >= 0),
        location text NOT NULL CHECK (location IN ('fridge', 'freezer', 'pantry', 'other')),
        added_at timestamptz NOT NULL DEFAULT now(),
        expires_on date,
        opened_at timestamptz,
        price numeric(12, 2) CHECK (price >= 0),
        store_id uuid REFERENCES stores (id) ON DELETE SET NULL,
        trip_id uuid REFERENCES shopping_trips (id) ON DELETE SET NULL,
        note text NOT NULL DEFAULT '',
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        finished_at timestamptz
      );
      CREATE INDEX stock_lots_active_idx ON stock_lots (household_id, product_id) WHERE finished_at IS NULL;

      CREATE TABLE recipes (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        title text NOT NULL,
        description text NOT NULL DEFAULT '',
        servings integer NOT NULL DEFAULT 2 CHECK (servings BETWEEN 1 AND 100),
        prep_minutes integer CHECK (prep_minutes >= 0),
        cook_minutes integer CHECK (cook_minutes >= 0),
        tags text[] NOT NULL DEFAULT '{}',
        steps text[] NOT NULL DEFAULT '{}',
        icon text NOT NULL DEFAULT 'pot',
        source_url text NOT NULL DEFAULT '',
        notes text NOT NULL DEFAULT '',
        favorite boolean NOT NULL DEFAULT false,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_via text NOT NULL DEFAULT 'app' CHECK (created_via IN ('app', 'ai')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        archived_at timestamptz
      );
      CREATE INDEX recipes_household_idx ON recipes (household_id) WHERE archived_at IS NULL;

      CREATE TABLE recipe_ingredients (
        id uuid PRIMARY KEY,
        recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
        product_id uuid REFERENCES products (id) ON DELETE SET NULL,
        name text NOT NULL,
        amount numeric(12, 3) CHECK (amount > 0),
        unit text,
        note text NOT NULL DEFAULT '',
        optional boolean NOT NULL DEFAULT false,
        sort integer NOT NULL DEFAULT 0
      );
      CREATE INDEX recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id, sort);

      CREATE TABLE meals (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        date date NOT NULL,
        time time,
        slot text NOT NULL DEFAULT 'dinner' CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
        recipe_id uuid REFERENCES recipes (id) ON DELETE SET NULL,
        title text NOT NULL,
        servings integer NOT NULL DEFAULT 2 CHECK (servings BETWEEN 1 AND 100),
        status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'skipped')),
        note text NOT NULL DEFAULT '',
        done_at timestamptz,
        leftovers_lot_id uuid REFERENCES stock_lots (id) ON DELETE SET NULL,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_via text NOT NULL DEFAULT 'app' CHECK (created_via IN ('app', 'ai')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX meals_household_date_idx ON meals (household_id, date);

      CREATE TABLE meal_ingredients (
        id uuid PRIMARY KEY,
        meal_id uuid NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
        product_id uuid REFERENCES products (id) ON DELETE SET NULL,
        lot_id uuid REFERENCES stock_lots (id) ON DELETE SET NULL,
        name text NOT NULL,
        amount numeric(12, 3) CHECK (amount > 0),
        unit text,
        note text NOT NULL DEFAULT '',
        optional boolean NOT NULL DEFAULT false,
        sort integer NOT NULL DEFAULT 0
      );
      CREATE INDEX meal_ingredients_meal_idx ON meal_ingredients (meal_id, sort);

      CREATE TABLE stock_events (
        id bigserial PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
        lot_id uuid REFERENCES stock_lots (id) ON DELETE SET NULL,
        kind text NOT NULL CHECK (kind IN ('added', 'used', 'wasted', 'adjusted', 'moved', 'restored')),
        delta numeric(12, 3) NOT NULL,
        meal_id uuid REFERENCES meals (id) ON DELETE SET NULL,
        actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
        via text NOT NULL DEFAULT 'app' CHECK (via IN ('app', 'ai')),
        note text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX stock_events_product_idx ON stock_events (product_id, created_at DESC);
      CREATE INDEX stock_events_meal_idx ON stock_events (meal_id) WHERE meal_id IS NOT NULL;
      CREATE INDEX stock_events_household_idx ON stock_events (household_id, created_at DESC);

      CREATE TABLE shopping_items (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        store_id uuid REFERENCES stores (id) ON DELETE SET NULL,
        product_id uuid REFERENCES products (id) ON DELETE SET NULL,
        name text NOT NULL,
        amount numeric(12, 3) CHECK (amount > 0),
        unit text,
        note text NOT NULL DEFAULT '',
        source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'plan', 'low_stock', 'recipe', 'ai')),
        checked_at timestamptz,
        price numeric(12, 2) CHECK (price >= 0),
        trip_id uuid REFERENCES shopping_trips (id) ON DELETE CASCADE,
        lot_id uuid REFERENCES stock_lots (id) ON DELETE SET NULL,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX shopping_items_active_idx ON shopping_items (household_id, store_id) WHERE trip_id IS NULL;
      CREATE INDEX shopping_items_trip_idx ON shopping_items (trip_id) WHERE trip_id IS NOT NULL;

      CREATE TABLE api_tokens (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        name text NOT NULL,
        token_hash text NOT NULL UNIQUE,
        prefix text NOT NULL,
        scope text NOT NULL CHECK (scope IN ('food:read', 'food', 'admin')),
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz,
        revoked_at timestamptz
      );
      CREATE INDEX api_tokens_user_idx ON api_tokens (user_id) WHERE revoked_at IS NULL;
    `,
  },
  {
    version: 3,
    name: 'food: shelf life once opened; staples that are not tracked',
    sql: `
      ALTER TABLE products ADD COLUMN opened_days integer CHECK (opened_days > 0);
      ALTER TABLE products ADD COLUMN track_stock boolean NOT NULL DEFAULT true;
    `,
  },
  {
    version: 4,
    name: 'food: items tracked by level (full, low, out) instead of amounts',
    sql: `
      ALTER TABLE products ADD COLUMN track_mode text NOT NULL DEFAULT 'exact' CHECK (track_mode IN ('exact', 'level', 'none'));
      UPDATE products SET track_mode = 'none' WHERE NOT track_stock;
      ALTER TABLE products ADD COLUMN level text NOT NULL DEFAULT 'out' CHECK (level IN ('full', 'low', 'out'));
      ALTER TABLE products ADD COLUMN level_at timestamptz;
      ALTER TABLE stock_events DROP CONSTRAINT stock_events_kind_check;
      ALTER TABLE stock_events ADD CONSTRAINT stock_events_kind_check
        CHECK (kind IN ('added', 'used', 'wasted', 'adjusted', 'moved', 'restored', 'level'));
    `,
  },
  {
    version: 5,
    name: 'food: how long items keep frozen and once thawed',
    sql: `
      ALTER TABLE products ADD COLUMN freezer_days integer CHECK (freezer_days > 0);
      ALTER TABLE products ADD COLUMN thawed_days integer CHECK (thawed_days > 0);
    `,
  },
  {
    version: 6,
    name: 'food: a balcony garden, undo by event, indexes, spices kept by level',
    sql: `
      ALTER TABLE products DROP CONSTRAINT products_location_check;
      ALTER TABLE products ADD CONSTRAINT products_location_check CHECK (location IN ('fridge', 'freezer', 'pantry', 'garden', 'other'));
      ALTER TABLE stock_lots DROP CONSTRAINT stock_lots_location_check;
      ALTER TABLE stock_lots ADD CONSTRAINT stock_lots_location_check CHECK (location IN ('fridge', 'freezer', 'pantry', 'garden', 'other'));

      ALTER TABLE stock_events ADD COLUMN undone_at timestamptz;

      CREATE INDEX meals_recipe_idx ON meals (recipe_id) WHERE recipe_id IS NOT NULL;
      CREATE INDEX stock_lots_price_idx ON stock_lots (household_id, product_id, store_id, added_at DESC) WHERE price IS NOT NULL;

      -- Spices, sauces and oils made before level tracking: full if they had stock, else out.
      UPDATE products p
         SET track_mode = 'level', track_stock = true, level_at = now(),
             level = CASE WHEN EXISTS (SELECT 1 FROM stock_lots l WHERE l.product_id = p.id AND l.finished_at IS NULL AND l.quantity > 0) THEN 'full' ELSE 'out' END
       WHERE p.track_mode = 'exact'
         AND (p.category = 'spices' OR p.name IN ('Sunflower oil', 'Olive oil', 'Honey', 'Jam', 'Tomato paste', 'Coffee', 'Tea'));
      UPDATE stock_lots l SET quantity = 0, finished_at = now()
        FROM products p
       WHERE l.product_id = p.id AND p.track_mode = 'level' AND l.finished_at IS NULL;
    `,
  },
  {
    version: 7,
    name: 'food: extra units and kinds per item, urgent shopping, meals to go; reminders',
    sql: `
      -- Extra units an item can be counted in ("slice" of bread, "pack" of pasta), sizes in its base unit.
      ALTER TABLE products ADD COLUMN units jsonb NOT NULL DEFAULT '[]'::jsonb;
      -- Kinds of one item (cheese: cheddar, parmesan…); each piece in stock says which.
      ALTER TABLE products ADD COLUMN variants text[] NOT NULL DEFAULT '{}';
      ALTER TABLE stock_lots ADD COLUMN variant text NOT NULL DEFAULT '';
      ALTER TABLE shopping_items ADD COLUMN variant text NOT NULL DEFAULT '';
      ALTER TABLE shopping_items ADD COLUMN priority boolean NOT NULL DEFAULT false;
      ALTER TABLE shopping_items ADD COLUMN need_by date;
      ALTER TABLE meals ADD COLUMN to_go boolean NOT NULL DEFAULT false;

      CREATE TABLE push_subscriptions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        endpoint text NOT NULL UNIQUE,
        p256dh text NOT NULL,
        auth text NOT NULL,
        user_agent text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        last_ok_at timestamptz
      );
      CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

      CREATE TABLE reminders (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('shopping', 'expiring', 'meal', 'prep', 'custom')),
        time time,
        minutes_before integer CHECK (minutes_before BETWEEN 5 AND 600),
        days integer[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
        text text NOT NULL DEFAULT '',
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX reminders_user_idx ON reminders (user_id);

      -- One send per reminder per occasion (a day, or a meal).
      CREATE TABLE reminder_log (
        reminder_id uuid NOT NULL REFERENCES reminders (id) ON DELETE CASCADE,
        key text NOT NULL,
        sent_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (reminder_id, key)
      );
    `,
  },
  {
    version: 8,
    name: 'food: allergies and foods people avoid',
    sql: `
      CREATE TABLE food_restrictions (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        product_id uuid REFERENCES products (id) ON DELETE CASCADE,
        category text,
        kind text NOT NULL CHECK (kind IN ('allergy', 'avoid')),
        note text NOT NULL DEFAULT '',
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (product_id IS NOT NULL OR category IS NOT NULL)
      );
      CREATE INDEX food_restrictions_household_idx ON food_restrictions (household_id);
    `,
  },
  {
    version: 9,
    name: 'food: packages (a jar of 400 g, a loaf of 20 slices) on lots and on what was bought',
    sql: `
      ALTER TABLE stock_lots ADD COLUMN package text NOT NULL DEFAULT '';
      ALTER TABLE stock_lots ADD COLUMN package_size numeric(12, 3) CHECK (package_size > 0);
      ALTER TABLE shopping_items ADD COLUMN package text NOT NULL DEFAULT '';
      ALTER TABLE shopping_items ADD COLUMN bought jsonb;
      -- Bread was counted in loaves with a slice of 1/20; it is now counted in slices, a loaf being 20.
      UPDATE stock_lots SET quantity = quantity * 20, initial_quantity = initial_quantity * 20, package = 'loaf', package_size = 20
       WHERE product_id IN (SELECT id FROM products WHERE units = '[{"name": "slice", "size": 0.05}]'::jsonb);
      UPDATE products SET units = '[{"name": "loaf", "plural": "loaves", "size": 20, "sizes": [12, 16, 20, 24, 30]}, {"name": "slice", "size": 1}]'::jsonb, piece_size = 25, piece_unit = 'g'
       WHERE units = '[{"name": "slice", "size": 0.05}]'::jsonb;
    `,
  },
  {
    version: 10,
    name: 'food: meals of several parts (dish, sauce, side, drink); where an item goes once opened',
    sql: `
      CREATE TABLE meal_parts (
        id uuid PRIMARY KEY,
        meal_id uuid NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
        recipe_id uuid REFERENCES recipes (id) ON DELETE SET NULL,
        title text NOT NULL,
        kind text NOT NULL DEFAULT 'dish' CHECK (kind IN ('dish', 'side', 'sauce', 'drink')),
        servings integer NOT NULL DEFAULT 2 CHECK (servings BETWEEN 1 AND 100),
        sort integer NOT NULL DEFAULT 0
      );
      CREATE INDEX meal_parts_meal_idx ON meal_parts (meal_id, sort);
      ALTER TABLE meal_ingredients ADD COLUMN part_id uuid REFERENCES meal_parts (id) ON DELETE CASCADE;
      -- Every meal made from a recipe gets that recipe as its first part, holding its lines.
      INSERT INTO meal_parts (id, meal_id, recipe_id, title, kind, servings, sort)
        SELECT gen_random_uuid(), m.id, m.recipe_id, m.title, 'dish', m.servings, 0 FROM meals m WHERE m.recipe_id IS NOT NULL;
      UPDATE meal_ingredients i SET part_id = p.id FROM meal_parts p WHERE p.meal_id = i.meal_id;

      ALTER TABLE products ADD COLUMN opened_location text CHECK (opened_location IN ('fridge', 'freezer', 'pantry', 'garden', 'other'));
    `,
  },
  {
    version: 11,
    name: 'food: an ingredient can ask for one type (Vodka, Finlandia)',
    sql: `
      ALTER TABLE recipe_ingredients ADD COLUMN variant text NOT NULL DEFAULT '';
      ALTER TABLE meal_ingredients ADD COLUMN variant text NOT NULL DEFAULT '';
    `,
  },
  {
    version: 12,
    name: 'kitchenware: pots, pans and bowls, clean or dirty; what recipes need',
    sql: `
      CREATE TABLE tools (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        name text NOT NULL,
        icon text NOT NULL DEFAULT 'box',
        kind text NOT NULL DEFAULT 'cookware' CHECK (kind IN ('cookware', 'bakeware', 'utensil', 'dishes', 'bar', 'appliance', 'other')),
        count integer NOT NULL DEFAULT 1 CHECK (count >= 0),
        dirty integer NOT NULL DEFAULT 0 CHECK (dirty >= 0),
        washing integer NOT NULL DEFAULT 0 CHECK (washing >= 0),
        washing_until timestamptz,
        washable boolean NOT NULL DEFAULT true,
        place text NOT NULL DEFAULT '',
        note text NOT NULL DEFAULT '',
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX tools_household_idx ON tools (household_id);

      CREATE TABLE recipe_tools (
        recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
        tool_id uuid NOT NULL REFERENCES tools (id) ON DELETE CASCADE,
        count integer NOT NULL DEFAULT 1 CHECK (count BETWEEN 1 AND 20),
        PRIMARY KEY (recipe_id, tool_id)
      );
      CREATE INDEX recipe_tools_tool_idx ON recipe_tools (tool_id);

      -- What a meal made dirty, so reopening it can take that back.
      ALTER TABLE meals ADD COLUMN dirtied jsonb;
      ALTER TABLE households ADD COLUMN dishwasher_minutes integer NOT NULL DEFAULT 180 CHECK (dishwasher_minutes BETWEEN 10 AND 600);
    `,
  },
  {
    version: 13,
    name: 'food: an ingredient can be one of several (milk or whipped cream)',
    sql: `
      ALTER TABLE recipe_ingredients ADD COLUMN alternatives jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE meal_ingredients ADD COLUMN alternatives jsonb NOT NULL DEFAULT '[]'::jsonb;
    `,
  },
  {
    version: 14,
    name: 'food: which catalog a kitchen has been brought up to',
    sql: `ALTER TABLE households ADD COLUMN catalog_version integer NOT NULL DEFAULT 0;`,
  },
  {
    version: 15,
    name: 'food: which option a planned meal takes (milk, or whipped cream)',
    sql: `ALTER TABLE meal_ingredients ADD COLUMN choice smallint CHECK (choice BETWEEN 0 AND 4);`,
  },
  {
    version: 16,
    name: 'kitchenware: hand-wash only, single-use things, this-or-that and per-serving needs',
    sql: `
      ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_kind_check;
      ALTER TABLE tools ADD CONSTRAINT tools_kind_check CHECK (kind IN ('cookware', 'bakeware', 'utensil', 'dishes', 'bar', 'appliance', 'disposable', 'other'));
      ALTER TABLE tools ADD COLUMN dishwasher_safe boolean NOT NULL DEFAULT true;
      ALTER TABLE tools ADD COLUMN min_count integer CHECK (min_count >= 0);
      ALTER TABLE recipe_tools ADD COLUMN alternatives uuid[] NOT NULL DEFAULT '{}';
      ALTER TABLE recipe_tools ADD COLUMN per_serving boolean NOT NULL DEFAULT false;
      -- What was there before: knives, boards and the like go by hand; an electric kettle is never washed.
      UPDATE tools SET dishwasher_safe = false WHERE icon IN ('knife', 'board', 'grill', 'blender', 'mixer', 'scissors');
      UPDATE tools SET washable = false, name = 'Electric kettle' WHERE icon = 'kettle' AND name = 'Kettle';
      UPDATE recipe_tools SET per_serving = true WHERE tool_id IN (SELECT id FROM tools WHERE kind = 'dishes');
    `,
  },
  {
    version: 17,
    name: 'food: meals eaten out (a restaurant, a delivery, a party): in the history, not from the kitchen',
    sql: `
      ALTER TABLE meals ADD COLUMN out_kind text CHECK (out_kind IN ('restaurant', 'delivery', 'party', 'work', 'other'));
      ALTER TABLE meals ADD COLUMN out_place text NOT NULL DEFAULT '';
      ALTER TABLE meals ADD COLUMN out_cost numeric(10, 2) CHECK (out_cost >= 0);
    `,
  },
  {
    version: 18,
    name: 'training',
    sql: `
      ALTER TABLE households ADD COLUMN training_catalog_version integer NOT NULL DEFAULT 0;

      -- What the household trains with at home. Weights in kg; pairs = the weights come two of each.
      CREATE TABLE training_equipment (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        kind text NOT NULL,
        name text NOT NULL,
        icon text NOT NULL DEFAULT 'mat',
        weights numeric(6, 2)[] NOT NULL DEFAULT '{}',
        pairs boolean NOT NULL DEFAULT false,
        count integer NOT NULL DEFAULT 1 CHECK (count >= 0),
        note text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX training_equipment_household_idx ON training_equipment (household_id);

      -- The household's exercises: the catalog's (preset) and its own.
      CREATE TABLE training_exercises (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        preset text,
        name text NOT NULL,
        category text NOT NULL CHECK (category IN ('strength', 'cardio', 'core', 'mobility', 'stretch')),
        muscles text[] NOT NULL DEFAULT '{}',
        secondary text[] NOT NULL DEFAULT '{}',
        equipment jsonb NOT NULL DEFAULT '[]',
        measure text NOT NULL CHECK (measure IN ('reps', 'time', 'distance')),
        weighted boolean NOT NULL DEFAULT false,
        unilateral boolean NOT NULL DEFAULT false,
        reps integer CHECK (reps > 0),
        seconds integer CHECK (seconds > 0),
        distance integer CHECK (distance > 0),
        rest integer NOT NULL DEFAULT 60 CHECK (rest >= 0),
        level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
        impact text NOT NULL DEFAULT 'low' CHECK (impact IN ('low', 'high')),
        icon text NOT NULL DEFAULT 'squat',
        steps text[] NOT NULL DEFAULT '{}',
        note text NOT NULL DEFAULT '',
        archived_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (household_id, preset)
      );
      CREATE INDEX training_exercises_household_idx ON training_exercises (household_id);

      -- Exercises someone keeps at hand for logging a set in passing.
      CREATE TABLE training_pins (
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        exercise_id uuid NOT NULL REFERENCES training_exercises (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, exercise_id)
      );

      -- Saved workouts to plan again: an ordered list of exercises with their sets.
      CREATE TABLE training_routines (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        name text NOT NULL,
        note text NOT NULL DEFAULT '',
        items jsonb NOT NULL DEFAULT '[]',
        rounds integer NOT NULL DEFAULT 1 CHECK (rounds BETWEEN 1 AND 20),
        round_rest integer NOT NULL DEFAULT 60 CHECK (round_rest >= 0),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX training_routines_household_idx ON training_routines (household_id);

      -- One person's workout on a day: planned, under way, done or skipped.
      CREATE TABLE training_workouts (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        date date NOT NULL,
        time text,
        title text NOT NULL,
        routine_id uuid REFERENCES training_routines (id) ON DELETE SET NULL,
        items jsonb NOT NULL DEFAULT '[]',
        rounds integer NOT NULL DEFAULT 1 CHECK (rounds BETWEEN 1 AND 20),
        round_rest integer NOT NULL DEFAULT 60 CHECK (round_rest >= 0),
        status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'done', 'skipped')),
        started_at timestamptz,
        finished_at timestamptz,
        duration_seconds integer CHECK (duration_seconds >= 0),
        feeling smallint CHECK (feeling BETWEEN 1 AND 5),
        note text NOT NULL DEFAULT '',
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX training_workouts_person_idx ON training_workouts (household_id, user_id, date);

      -- Every set done: in a workout, or logged on its own (a push-up in passing).
      CREATE TABLE training_sets (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        exercise_id uuid NOT NULL REFERENCES training_exercises (id) ON DELETE CASCADE,
        workout_id uuid REFERENCES training_workouts (id) ON DELETE CASCADE,
        item_index integer,
        round integer,
        set_number integer,
        side text CHECK (side IN ('left', 'right')),
        reps integer CHECK (reps >= 0),
        weight numeric(6, 2) CHECK (weight >= 0),
        seconds integer CHECK (seconds >= 0),
        distance integer CHECK (distance >= 0),
        performed_at timestamptz NOT NULL,
        day date NOT NULL,
        time_known boolean NOT NULL DEFAULT true,
        effort smallint CHECK (effort BETWEEN 1 AND 10),
        note text NOT NULL DEFAULT '',
        via text NOT NULL DEFAULT 'app' CHECK (via IN ('app', 'ai')),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX training_sets_person_day_idx ON training_sets (household_id, user_id, day);
      CREATE INDEX training_sets_exercise_idx ON training_sets (user_id, exercise_id, performed_at DESC);
      CREATE INDEX training_sets_workout_idx ON training_sets (workout_id) WHERE workout_id IS NOT NULL;
    `,
  },
  {
    version: 19,
    name: 'health data',
    sql: `
      -- One value per person, day, kind and source (Apple Health, Health Connect, typed in): a
      -- daily sync overwrites the day as it fills up.
      CREATE TABLE health_days (
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        day date NOT NULL,
        kind text NOT NULL,
        source text NOT NULL CHECK (source IN ('apple', 'google', 'manual')),
        value numeric(12, 3) NOT NULL CHECK (value >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, day, kind, source)
      );
      CREATE INDEX health_days_person_idx ON health_days (household_id, user_id, day);

      -- Workouts brought in from a health app become sets once, however often they are synced.
      ALTER TABLE training_sets ADD COLUMN external_id text;
      CREATE UNIQUE INDEX training_sets_external_idx ON training_sets (user_id, external_id) WHERE external_id IS NOT NULL;
    `,
  },
  {
    version: 20,
    name: 'each person their own exercises; equipment pieces, variations; profile',
    sql: `
      -- The profile: a picture, gender, birth date, height.
      ALTER TABLE users ADD COLUMN gender text CHECK (gender IN ('female', 'male', 'other'));
      ALTER TABLE users ADD COLUMN birth_date date;
      ALTER TABLE users ADD COLUMN height_cm smallint CHECK (height_cm BETWEEN 40 AND 250);
      ALTER TABLE users ADD COLUMN avatar bytea;
      ALTER TABLE users ADD COLUMN avatar_type text;
      ALTER TABLE users ADD COLUMN avatar_at timestamptz;
      ALTER TABLE users ADD COLUMN training_catalog_version integer NOT NULL DEFAULT 0;

      -- Equipment pieces with their own name and resistance: each band, each grip of the bar.
      ALTER TABLE training_equipment ADD COLUMN variants jsonb NOT NULL DEFAULT '[]';

      -- Exercises and routines are each person's; equipment stays the household's. What exists
      -- goes to the household's first member (the catalog copy) or whoever made it; the others get
      -- their own copy of the catalog on their next visit.
      ALTER TABLE training_exercises ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE CASCADE;
      ALTER TABLE training_exercises ADD COLUMN variants text[] NOT NULL DEFAULT '{}';
      UPDATE training_exercises e SET user_id = coalesce(e.created_by,
        (SELECT u.id FROM users u WHERE u.household_id = e.household_id ORDER BY u.created_at LIMIT 1));
      -- Someone else's sets on those exercises: their own copy, and the sets moved onto it.
      INSERT INTO training_exercises (id, household_id, user_id, preset, name, category, muscles, secondary, equipment, measure, weighted,
                                      unilateral, reps, seconds, distance, rest, level, impact, icon, steps, note, archived_at, created_at, updated_at)
        SELECT DISTINCT ON (s.user_id, e.id) gen_random_uuid(), e.household_id, s.user_id, e.preset, e.name, e.category, e.muscles, e.secondary,
               e.equipment, e.measure, e.weighted, e.unilateral, e.reps, e.seconds, e.distance, e.rest, e.level, e.impact, e.icon, e.steps,
               e.note, e.archived_at, now(), now()
          FROM training_sets s JOIN training_exercises e ON e.id = s.exercise_id WHERE e.user_id <> s.user_id;
      UPDATE training_sets s SET exercise_id = mine.id
        FROM training_exercises theirs, training_exercises mine
       WHERE theirs.id = s.exercise_id AND theirs.user_id <> s.user_id
         AND mine.user_id = s.user_id AND mine.name = theirs.name AND mine.household_id = theirs.household_id;
      DELETE FROM training_exercises WHERE user_id IS NULL;
      ALTER TABLE training_exercises ALTER COLUMN user_id SET NOT NULL;
      ALTER TABLE training_exercises DROP CONSTRAINT training_exercises_household_id_preset_key;
      CREATE UNIQUE INDEX training_exercises_person_preset_idx ON training_exercises (user_id, preset) WHERE preset IS NOT NULL;
      CREATE INDEX training_exercises_person_idx ON training_exercises (user_id);
      UPDATE users u SET training_catalog_version = h.training_catalog_version
        FROM households h WHERE h.id = u.household_id AND EXISTS (SELECT 1 FROM training_exercises e WHERE e.user_id = u.id);

      ALTER TABLE training_routines ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE CASCADE;
      UPDATE training_routines r SET user_id = coalesce(r.created_by,
        (SELECT u.id FROM users u WHERE u.household_id = r.household_id ORDER BY u.created_at LIMIT 1));
      DELETE FROM training_routines WHERE user_id IS NULL;
      ALTER TABLE training_routines ALTER COLUMN user_id SET NOT NULL;

      -- Which grip, stance or band a set was done with.
      ALTER TABLE training_sets ADD COLUMN variant text NOT NULL DEFAULT '';
    `,
  },
  {
    version: 21,
    name: 'nutrition and energy',
    sql: `
      -- The household's own nutrition for an item (per 100 g / 100 ml / piece, kinds apart);
      -- without it, the catalog's typical values count.
      ALTER TABLE products ADD COLUMN nutrition jsonb;

      -- Who ate a meal (empty: everyone when there's a serving each, else whoever marked it eaten),
      -- who marked it, and for eating out the kcal per person.
      ALTER TABLE meals ADD COLUMN eaters uuid[] NOT NULL DEFAULT '{}';
      ALTER TABLE meals ADD COLUMN done_by uuid REFERENCES users (id) ON DELETE SET NULL;
      ALTER TABLE meals ADD COLUMN out_kcal integer CHECK (out_kcal BETWEEN 0 AND 10000);
      UPDATE meals SET done_by = created_by WHERE status = 'done';

      -- What someone is aiming for: lose, keep or gain weight, at what pace, and how active a
      -- day is without the phone's numbers.
      ALTER TABLE users ADD COLUMN goal text CHECK (goal IN ('lose', 'keep', 'gain'));
      ALTER TABLE users ADD COLUMN goal_weight numeric(5, 1) CHECK (goal_weight BETWEEN 20 AND 400);
      ALTER TABLE users ADD COLUMN goal_rate numeric(3, 2) CHECK (goal_rate BETWEEN 0 AND 1.5);
      ALTER TABLE users ADD COLUMN activity text CHECK (activity IN ('sedentary', 'light', 'moderate', 'active', 'very'));
    `,
  },
  {
    version: 22,
    name: 'the house: bathroom and storage',
    sql: `
      ALTER TABLE products DROP CONSTRAINT products_location_check;
      ALTER TABLE products ADD CONSTRAINT products_location_check CHECK (location IN ('fridge', 'freezer', 'pantry', 'garden', 'bathroom', 'storage', 'other'));
      ALTER TABLE stock_lots DROP CONSTRAINT stock_lots_location_check;
      ALTER TABLE stock_lots ADD CONSTRAINT stock_lots_location_check CHECK (location IN ('fridge', 'freezer', 'pantry', 'garden', 'bathroom', 'storage', 'other'));
      ALTER TABLE products DROP CONSTRAINT IF EXISTS products_opened_location_check;
      ALTER TABLE products ADD CONSTRAINT products_opened_location_check CHECK (opened_location IN ('fridge', 'freezer', 'pantry', 'garden', 'bathroom', 'storage', 'other'));
    `,
  },
  {
    version: 23,
    name: 'OAuth sign-in for assistants (Claude, Codex, ChatGPT) on the MCP server',
    sql: `
      CREATE TABLE oauth_clients (
        id text PRIMARY KEY,
        name text NOT NULL,
        redirect_uris text[] NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE oauth_codes (
        code_hash text PRIMARY KEY,
        client_id text NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        redirect_uri text NOT NULL,
        code_challenge text NOT NULL,
        scope text NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz
      );
      ALTER TABLE api_tokens ADD COLUMN oauth_client_id text REFERENCES oauth_clients(id) ON DELETE SET NULL;
    `,
  },
  {
    version: 24,
    name: 'travel: bags, trips and their packing lists',
    sql: `
      CREATE TABLE travel_bags (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name text NOT NULL,
        kind text NOT NULL CHECK (kind IN ('backpack', 'handbag', 'carry-on', 'suitcase', 'duffel', 'other')),
        length_cm numeric(5, 1),
        width_cm numeric(5, 1),
        height_cm numeric(5, 1),
        note text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL
      );
      CREATE INDEX travel_bags_household_idx ON travel_bags (household_id);

      CREATE TABLE travel_items (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        preset text,
        name text NOT NULL,
        grp text NOT NULL,
        quantity text NOT NULL DEFAULT 'one' CHECK (quantity IN ('one', 'person', 'day', 'person_day')),
        rules jsonb NOT NULL DEFAULT '{}',
        sort integer NOT NULL DEFAULT 0,
        archived_at timestamptz,
        created_at timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX travel_items_preset_idx ON travel_items (household_id, preset) WHERE preset IS NOT NULL;

      CREATE TABLE trips (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name text NOT NULL,
        destination text NOT NULL DEFAULT '',
        scope text NOT NULL CHECK (scope IN ('national', 'international')),
        kind text NOT NULL CHECK (kind IN ('vacation', 'family', 'day', 'event', 'work', 'other')),
        transport text NOT NULL CHECK (transport IN ('car', 'bus', 'train', 'plane', 'other')),
        start_date date NOT NULL,
        end_date date NOT NULL CHECK (end_date >= start_date),
        depart_time time,
        return_time time,
        people uuid[] NOT NULL DEFAULT '{}',
        guests integer NOT NULL DEFAULT 0 CHECK (guests BETWEEN 0 AND 50),
        bag_ids uuid[] NOT NULL DEFAULT '{}',
        overrides jsonb NOT NULL DEFAULT '{}',
        note text NOT NULL DEFAULT '',
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX trips_household_idx ON trips (household_id, start_date);

      CREATE TABLE trip_checks (
        id uuid PRIMARY KEY,
        trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        item_id uuid REFERENCES travel_items(id) ON DELETE CASCADE,
        name text NOT NULL,
        grp text NOT NULL,
        quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
        checked_at timestamptz,
        checked_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX trip_checks_item_idx ON trip_checks (trip_id, item_id) WHERE item_id IS NOT NULL;

      ALTER TABLE households ADD COLUMN travel_catalog_version integer NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 25,
    name: 'travel: deadlines (done by so many hours before leaving)',
    sql: `
      ALTER TABLE travel_items ADD COLUMN due_hours integer CHECK (due_hours BETWEEN 0 AND 2160);
      ALTER TABLE trip_checks ADD COLUMN due_hours integer CHECK (due_hours BETWEEN 0 AND 2160);
    `,
  },
  {
    version: 26,
    name: 'travel: things to buy before a trip',
    sql: `
      ALTER TABLE trip_checks ADD COLUMN to_buy boolean NOT NULL DEFAULT false;
      ALTER TABLE trip_checks ADD COLUMN listed_at timestamptz;
    `,
  },
  {
    version: 27,
    name: 'travel: arriving there and heading back',
    sql: `
      ALTER TABLE trips ADD COLUMN arrive_date date;
      ALTER TABLE trips ADD COLUMN arrive_time time;
      ALTER TABLE trips ADD COLUMN back_date date;
      ALTER TABLE trips ADD COLUMN back_time time;
    `,
  },
  {
    version: 28,
    name: 'travel: money for a trip (cash and cards, by currency)',
    sql: `
      ALTER TABLE trips ADD COLUMN money jsonb NOT NULL DEFAULT '[]';
    `,
  },
  {
    version: 29,
    name: 'travel: gear (power banks, chargers, cables) and what a trip takes',
    sql: `
      CREATE TABLE travel_gear (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name text NOT NULL,
        kind text NOT NULL CHECK (kind IN ('power-bank', 'charger', 'cable', 'adapter', 'headphones', 'other')),
        connectors text[] NOT NULL DEFAULT '{}',
        count integer NOT NULL DEFAULT 1 CHECK (count BETWEEN 0 AND 99),
        note text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL
      );
      CREATE INDEX travel_gear_household_idx ON travel_gear (household_id);
      ALTER TABLE trips ADD COLUMN gear jsonb NOT NULL DEFAULT '[]';
    `,
  },
  {
    version: 30,
    name: 'languages: each person’s language, and translations of what people write',
    sql: `
      ALTER TABLE users ADD COLUMN locale text CHECK (locale IN ('en', 'ro', 'ru'));
      ALTER TABLE products ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE stores ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE recipes ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE tools ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE meals ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE reminders ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE training_equipment ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE training_exercises ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE training_routines ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE travel_items ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE travel_bags ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE travel_gear ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE trips ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
    `,
  },
  {
    version: 31,
    name: 'paydays: the day of the month each person’s salary and advance come',
    sql: `
      -- Only the days, never amounts: the family plans around when money arrives. The advance
      -- (avans) is the part of the salary paid earlier in the month.
      ALTER TABLE users ADD COLUMN salary_day smallint CHECK (salary_day BETWEEN 1 AND 31);
      ALTER TABLE users ADD COLUMN advance_day smallint CHECK (advance_day BETWEEN 1 AND 31);
    `,
  },
  {
    version: 32,
    name: 'custom icons: each household’s own drawings for its items, as data',
    sql: `
      -- Drawn at run time (by Claude, through the API or MCP) so a new item gets its own picture
      -- with no release. shapes is a checked list of SVG shapes (modules/food/icons.ts), never markup.
      CREATE TABLE custom_icons (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        household_id uuid NOT NULL REFERENCES households (id) ON DELETE CASCADE,
        key text NOT NULL CHECK (key ~ '^custom:[a-z0-9]+(-[a-z0-9]+)*$'),
        name text NOT NULL,
        translations jsonb NOT NULL DEFAULT '{}',
        shapes jsonb NOT NULL,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (household_id, key)
      );
    `,
  },
  {
    version: 33,
    name: 'the household’s own names for an item’s kinds, per language',
    sql: `
      -- { "ro": { "Greek 2%": "Grecesc 2%" }, "ru": { … } }, keyed by the kind as stored, so each
      -- kind keeps its names when others are added, renamed or reordered. Wins over the catalog's.
      ALTER TABLE products ADD COLUMN variant_names jsonb NOT NULL DEFAULT '{}';
    `,
  },
  {
    version: 34,
    name: 'watching: films and series from TMDB, each person’s plays, lists and checks',
    sql: `
      -- TMDB's details, compact, per language as they are asked for ({ i18n: { en, ro, ru } }).
      -- Never evicted while someone's library points at them; images stay on TMDB's CDN.
      CREATE TABLE watch_titles (
        id text PRIMARY KEY CHECK (id ~ '^(movie|tv):[0-9]+$'),
        kind text NOT NULL CHECK (kind IN ('movie', 'tv')),
        tmdb_id integer NOT NULL,
        data jsonb NOT NULL,
        fetched_at timestamptz NOT NULL DEFAULT now()
      );

      -- One season's episodes, per show and season number.
      CREATE TABLE watch_episodes_cache (
        tmdb_id integer NOT NULL,
        season integer NOT NULL,
        data jsonb NOT NULL,
        fetched_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tmdb_id, season)
      );

      -- Everything else asked of TMDB (search, trending, discover, people, find, genres), with
      -- its own expiry; expired rows are swept as new ones are written.
      CREATE TABLE watch_tmdb_cache (
        key text PRIMARY KEY,
        data jsonb NOT NULL,
        fetched_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX watch_tmdb_cache_expires_idx ON watch_tmdb_cache (expires_at);

      -- Each person's library: where they are with a title.
      CREATE TABLE watch_list (
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        title_id text NOT NULL REFERENCES watch_titles (id),
        status text NOT NULL CHECK (status IN ('watchlist', 'watching', 'rewatching', 'completed', 'paused', 'dropped')),
        favorite boolean NOT NULL DEFAULT false,
        rating smallint CHECK (rating BETWEEN 1 AND 10),
        notes text NOT NULL DEFAULT '',
        added_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, title_id)
      );

      -- One row per time something was watched; rewatching adds a row. A backfilled play may
      -- know only its day, its month, or nothing: those stay out of per-day and per-hour charts.
      CREATE TABLE watch_plays (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        title_id text NOT NULL REFERENCES watch_titles (id),
        season integer,
        episode integer,
        watched_at timestamptz,
        date_precision text NOT NULL DEFAULT 'exact' CHECK (date_precision IN ('exact', 'day', 'month', 'unknown')),
        runtime_min integer NOT NULL DEFAULT 0,
        source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'ai', 'import')),
        import_key text,
        -- Watched together: one play per person, one group, shown and undone together.
        group_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((season IS NULL) = (episode IS NULL)),
        CHECK ((watched_at IS NULL) = (date_precision = 'unknown'))
      );
      CREATE INDEX watch_plays_user_idx ON watch_plays (user_id, watched_at DESC);
      CREATE INDEX watch_plays_title_idx ON watch_plays (user_id, title_id, season, episode);
      CREATE INDEX watch_plays_group_idx ON watch_plays (group_id) WHERE group_id IS NOT NULL;
      CREATE UNIQUE INDEX watch_plays_import_key ON watch_plays (user_id, import_key) WHERE import_key IS NOT NULL;

      -- A person's rating, note and favourite for one episode.
      CREATE TABLE watch_episode_marks (
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        title_id text NOT NULL REFERENCES watch_titles (id),
        season integer NOT NULL,
        episode integer NOT NULL,
        rating smallint CHECK (rating BETWEEN 1 AND 10),
        note text NOT NULL DEFAULT '',
        favorite boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, title_id, season, episode)
      );

      -- Where a title really is in Moldova, as Claude (or someone) checked it.
      CREATE TABLE watch_availability (
        id uuid PRIMARY KEY,
        title_id text NOT NULL REFERENCES watch_titles (id),
        provider text NOT NULL,
        available boolean NOT NULL,
        note text NOT NULL DEFAULT '',
        checked_at timestamptz NOT NULL DEFAULT now(),
        checked_by uuid REFERENCES users (id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX watch_availability_provider_key ON watch_availability (title_id, lower(provider));

      CREATE TABLE watch_settings (
        user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        hide_spoilers boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Lists people make ("Movie night", "For Patricia"): their own, or the household's.
      CREATE TABLE watch_collections (
        id uuid PRIMARY KEY,
        owner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        household_id uuid REFERENCES households (id) ON DELETE CASCADE,
        name text NOT NULL,
        translations jsonb NOT NULL DEFAULT '{}',
        shared boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX watch_collections_owner_idx ON watch_collections (owner_id);
      CREATE INDEX watch_collections_household_idx ON watch_collections (household_id) WHERE shared;

      CREATE TABLE watch_collection_items (
        collection_id uuid NOT NULL REFERENCES watch_collections (id) ON DELETE CASCADE,
        title_id text NOT NULL REFERENCES watch_titles (id),
        position integer NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        added_by uuid REFERENCES users (id) ON DELETE SET NULL,
        added_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (collection_id, title_id)
      );
    `,
  },
  {
    version: 35,
    name: 'watching: how a title made you feel, a few reactions next to the rating and review',
    sql: `
      -- At most three of: loved, funny, wow, moving, tense, scary, meh, disliked (checked by the API).
      ALTER TABLE watch_list ADD COLUMN reactions text[] NOT NULL DEFAULT '{}';
    `,
  },
  {
    version: 36,
    name: 'the priority buy list: what the household wants to buy, in order',
    sql: `
      CREATE TABLE wishlist_items (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        -- true: everyone at home sees and edits it; false: only its owner.
        shared boolean NOT NULL DEFAULT true,
        name text NOT NULL,
        note text NOT NULL DEFAULT '',
        url text NOT NULL DEFAULT '',
        price numeric(12, 2),
        currency text NOT NULL DEFAULT 'MDL',
        urgency text NOT NULL DEFAULT 'soon' CHECK (urgency IN ('now', 'soon', 'someday')),
        category text NOT NULL DEFAULT '',
        -- The hand-made order of what's still wanted: lower comes first.
        position integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'wanted' CHECK (status IN ('wanted', 'bought', 'dropped')),
        bought_price numeric(12, 2),
        bought_on date,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX wishlist_items_household ON wishlist_items (household_id, status, position);
    `,
  },
  {
    version: 37,
    name: "drinks: the household cellar and everyone's tasting journal, with label photos",
    sql: `
      -- One specific version of a drink (a wine's vintage, Jack Daniel's Tennessee Honey), the
      -- household's. Versions of one family share the same line ("Jack Daniel's").
      CREATE TABLE drinks (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        category text NOT NULL CHECK (category IN ('wine', 'sparkling', 'fortified', 'brandy',
          'whisky', 'rum', 'vodka', 'gin', 'agave', 'liqueur', 'beer', 'cider', 'sake', 'other')),
        name text NOT NULL,
        producer text NOT NULL DEFAULT '',
        line text NOT NULL DEFAULT '',
        variant text NOT NULL DEFAULT '',
        vintage integer CHECK (vintage BETWEEN 1800 AND 2100),
        -- Bottled or produced on, when the label says a day rather than a year.
        produced_on date,
        age_years integer CHECK (age_years BETWEEN 0 AND 100),
        abv numeric(4, 1) CHECK (abv BETWEEN 0 AND 100),
        volume_ml integer CHECK (volume_ml > 0),
        -- ISO 3166 code (MD, FR); '' when unknown. Names are shown in the reader's language.
        country text NOT NULL DEFAULT '',
        region text NOT NULL DEFAULT '',
        appellation text NOT NULL DEFAULT '',
        grapes text[] NOT NULL DEFAULT '{}',
        -- Wine's colour: white, rose, red, orange; '' for the rest.
        color text NOT NULL DEFAULT '',
        -- Free words by kind: Brut, Extra Brut; VSOP, XO; Single malt; IPA.
        style text NOT NULL DEFAULT '',
        cask text NOT NULL DEFAULT '',
        label_text text NOT NULL DEFAULT '',
        tags text[] NOT NULL DEFAULT '{}',
        notes text NOT NULL DEFAULT '',
        -- The last price paid; every price ever paid is in drink_prices.
        price numeric(12, 2),
        currency text NOT NULL DEFAULT 'MDL',
        bought_at text NOT NULL DEFAULT '',
        -- The cellar: bottles at home, where, one open, when bought; or only wanted.
        stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
        location text NOT NULL DEFAULT '',
        opened boolean NOT NULL DEFAULT false,
        bought_on date,
        wanted boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX drinks_household ON drinks (household_id, category);
      CREATE INDEX drinks_line ON drinks (household_id, lower(line)) WHERE line <> '';

      CREATE TABLE drink_prices (
        id uuid PRIMARY KEY,
        drink_id uuid NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
        price numeric(12, 2) NOT NULL,
        currency text NOT NULL,
        bought_at text NOT NULL DEFAULT '',
        bought_on date,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX drink_prices_drink ON drink_prices (drink_id, created_at);

      -- One person's tasting, kept for good and seen by the household.
      CREATE TABLE drink_tastings (
        id uuid PRIMARY KEY,
        drink_id uuid NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        tasted_on date NOT NULL,
        place text NOT NULL DEFAULT '',
        occasion text NOT NULL DEFAULT '',
        country text NOT NULL DEFAULT '',
        with_people uuid[] NOT NULL DEFAULT '{}',
        with_others text NOT NULL DEFAULT '',
        -- Half stars: 1 = 0.5 star … 10 = 5 stars.
        rating smallint CHECK (rating BETWEEN 1 AND 10),
        score smallint CHECK (score BETWEEN 0 AND 100),
        buy_again boolean,
        comment text NOT NULL DEFAULT '',
        pairing text NOT NULL DEFAULT '',
        mode text NOT NULL DEFAULT 'quick' CHECK (mode IN ('quick', 'full')),
        -- The structured tasting sheet ({ v: 1, kind: wine | spirit | beer, … }), checked by the API.
        sheet jsonb,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX drink_tastings_drink ON drink_tastings (drink_id, tasted_on DESC);
      CREATE INDEX drink_tastings_household ON drink_tastings (household_id, tasted_on DESC);

      -- Label and moment photos, shrunk on upload (WebP, 1600 px and a 480 px thumb).
      CREATE TABLE drink_photos (
        id uuid PRIMARY KEY,
        drink_id uuid NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
        tasting_id uuid REFERENCES drink_tastings(id) ON DELETE CASCADE,
        position integer NOT NULL DEFAULT 0,
        kind text NOT NULL DEFAULT 'front' CHECK (kind IN ('front', 'back', 'other')),
        mime text NOT NULL,
        -- "full" is a reserved word: always quoted.
        "full" bytea NOT NULL,
        thumb bytea NOT NULL,
        width integer,
        height integer,
        bytes integer NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX drink_photos_drink ON drink_photos (drink_id, position);
    `,
  },
  {
    version: 38,
    name: 'watching: reactions on an episode, like the ones on a title',
    sql: `
      -- At most three of: loved, funny, wow, moving, tense, scary, meh, disliked (checked by the API).
      ALTER TABLE watch_episode_marks ADD COLUMN reactions text[] NOT NULL DEFAULT '{}';
    `,
  },
  {
    version: 39,
    name: 'food: a fourth level, half (medium), between full and low',
    sql: `
      -- The inline CHECK from migration 4 got Postgres's default name, products_level_check.
      ALTER TABLE products DROP CONSTRAINT IF EXISTS products_level_check;
      ALTER TABLE products ADD CONSTRAINT products_level_check
        CHECK (level IN ('full', 'half', 'low', 'out'));
    `,
  },
  {
    version: 40,
    name: 'food: recipe choices (Drink: creamy coffee or tea) with their own lines and steps; courses; translated lines; optional lines switched on or off per meal',
    sql: `
      -- A named group of alternative parts of a recipe; one option is used per meal.
      CREATE TABLE recipe_choices (
        id uuid PRIMARY KEY,
        recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
        name text NOT NULL,
        translations jsonb NOT NULL DEFAULT '{}'::jsonb,
        sort integer NOT NULL DEFAULT 0,
        -- The option picked last time (planned, switched or cooked): the default next time.
        last_option_id uuid
      );
      CREATE INDEX recipe_choices_recipe_idx ON recipe_choices (recipe_id, sort);

      CREATE TABLE recipe_options (
        id uuid PRIMARY KEY,
        choice_id uuid NOT NULL REFERENCES recipe_choices (id) ON DELETE CASCADE,
        name text NOT NULL,
        steps text[] NOT NULL DEFAULT '{}',
        translations jsonb NOT NULL DEFAULT '{}'::jsonb,
        sort integer NOT NULL DEFAULT 0
      );
      CREATE INDEX recipe_options_choice_idx ON recipe_options (choice_id, sort);
      ALTER TABLE recipe_choices ADD CONSTRAINT recipe_choices_last_option_fkey
        FOREIGN KEY (last_option_id) REFERENCES recipe_options (id) ON DELETE SET NULL;

      -- An option's own lines; NULL: the recipe's lines, always used.
      ALTER TABLE recipe_ingredients ADD COLUMN option_id uuid REFERENCES recipe_options (id) ON DELETE CASCADE;
      CREATE INDEX recipe_ingredients_option_idx ON recipe_ingredients (option_id) WHERE option_id IS NOT NULL;
      -- A meal copies only the chosen options' lines, each knowing its option, and keeps which were chosen.
      ALTER TABLE meal_ingredients ADD COLUMN option_id uuid REFERENCES recipe_options (id) ON DELETE SET NULL;
      ALTER TABLE meal_parts ADD COLUMN options uuid[] NOT NULL DEFAULT '{}';
      -- Courses: a meal (and a recipe) is made of sections — first course, second (dish), side,
      -- sauce, dessert, drinks. Meal parts gain the new kinds; lines and choices can name theirs.
      ALTER TABLE meal_parts DROP CONSTRAINT IF EXISTS meal_parts_kind_check;
      ALTER TABLE meal_parts ADD CONSTRAINT meal_parts_kind_check
        CHECK (kind IN ('first', 'dish', 'side', 'sauce', 'dessert', 'drink'));
      ALTER TABLE recipe_choices ADD COLUMN course text
        CHECK (course IN ('first', 'dish', 'side', 'sauce', 'dessert', 'drink'));
      ALTER TABLE recipe_ingredients ADD COLUMN course text
        CHECK (course IN ('first', 'dish', 'side', 'sauce', 'dessert', 'drink'));
      ALTER TABLE meal_ingredients ADD COLUMN course text
        CHECK (course IN ('first', 'dish', 'side', 'sauce', 'dessert', 'drink'));
      -- A line's own name in other languages (Water: Apă, Вода), for lines not kept in the kitchen.
      ALTER TABLE recipe_ingredients ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE meal_ingredients ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb;
      -- An optional line switched for one meal: true counts it like any line (needed, bought,
      -- eaten, taken), false leaves it out everywhere; NULL: as before (taken if there, not needed).
      ALTER TABLE meal_ingredients ADD COLUMN included boolean;
    `,
  },
  {
    version: 41,
    name: 'closet: everyone’s clothes, where they are kept, looks, days worn and packing lists',
    sql: `
      -- Where things are kept, the household's: rooms hold furniture, furniture holds sections
      -- (shelves numbered from the bottom, rails, drawers, boxes, hooks).
      CREATE TABLE closet_places (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        parent_id uuid REFERENCES closet_places(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('room', 'furniture', 'shelf', 'rail', 'drawer', 'box',
          'hook', 'section')),
        name text NOT NULL DEFAULT '',
        number integer CHECK (number BETWEEN 1 AND 99),
        side text NOT NULL DEFAULT '' CHECK (side IN ('', 'left', 'middle', 'right')),
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX closet_places_household ON closet_places (household_id, parent_id, position);

      -- One piece, one person's (the household sees each other's closets). Kinds and scales are
      -- checked by the API; care is the label's ISO 3758 symbols as JSON.
      CREATE TABLE closet_items (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        name text NOT NULL DEFAULT '',
        category text NOT NULL DEFAULT '',
        subcategory text NOT NULL DEFAULT '',
        colors text[] NOT NULL DEFAULT '{}',
        -- [{ "material": "cotton", "percent": 95 }, …]
        materials jsonb NOT NULL DEFAULT '[]'::jsonb,
        size text NOT NULL DEFAULT '',
        size_system text NOT NULL DEFAULT '',
        brand text NOT NULL DEFAULT '',
        price numeric(12, 2),
        currency text NOT NULL DEFAULT 'MDL',
        bought_on date,
        store text NOT NULL DEFAULT '',
        seasons text[] NOT NULL DEFAULT '{}',
        occasions text[] NOT NULL DEFAULT '{}',
        fit text NOT NULL DEFAULT '',
        condition text NOT NULL DEFAULT '',
        issues text[] NOT NULL DEFAULT '{}',
        condition_notes text NOT NULL DEFAULT '',
        tags text[] NOT NULL DEFAULT '{}',
        notes text NOT NULL DEFAULT '',
        url text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'clean' CHECK (status IN ('clean', 'to_wash', 'at_cleaners',
          'lent', 'wishlist', 'archived', 'sold', 'donated')),
        lent_to text NOT NULL DEFAULT '',
        favorite boolean NOT NULL DEFAULT false,
        place_id uuid REFERENCES closet_places(id) ON DELETE SET NULL,
        storage text NOT NULL DEFAULT '',
        care jsonb,
        storage_advice text NOT NULL DEFAULT '',
        made_in text NOT NULL DEFAULT '',
        label_text text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX closet_items_owner ON closet_items (household_id, owner_id, status);
      CREATE INDEX closet_items_recent ON closet_items (household_id, owner_id, created_at DESC, id DESC);
      CREATE INDEX closet_items_place ON closet_items (place_id) WHERE place_id IS NOT NULL;

      -- A look: pieces laid out on a canvas ({ v: 1, items: [{ itemId, x, y, scale, rotation, z }] }).
      -- Pieces are referenced by id inside the JSON, so deleting a piece never deletes a look:
      -- the look keeps a placeholder with its name.
      CREATE TABLE closet_looks (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL DEFAULT '',
        canvas jsonb NOT NULL DEFAULT '{"v": 1, "items": []}'::jsonb,
        backdrop jsonb NOT NULL DEFAULT '{"kind": "studio"}'::jsonb,
        seasons text[] NOT NULL DEFAULT '{}',
        occasions text[] NOT NULL DEFAULT '{}',
        notes text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX closet_looks_owner ON closet_looks (household_id, owner_id, updated_at DESC);

      -- Photos of a piece (front, back, label, detail) or a look's own backdrop, shrunk on upload
      -- (WebP, 1600 px and a 480 px thumb, transparency kept). A cut-out replaces its original in
      -- the gallery and keeps it (superseded), so the background can come back.
      CREATE TABLE closet_photos (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        item_id uuid REFERENCES closet_items(id) ON DELETE CASCADE,
        look_id uuid REFERENCES closet_looks(id) ON DELETE CASCADE,
        position integer NOT NULL DEFAULT 0,
        kind text NOT NULL DEFAULT 'front' CHECK (kind IN ('front', 'back', 'label', 'detail', 'backdrop')),
        mime text NOT NULL,
        "full" bytea NOT NULL,
        thumb bytea NOT NULL,
        width integer,
        height integer,
        bytes integer NOT NULL,
        has_alpha boolean NOT NULL DEFAULT false,
        needs_cutout boolean NOT NULL DEFAULT false,
        cutout_of uuid REFERENCES closet_photos(id) ON DELETE SET NULL,
        superseded boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL,
        CHECK (num_nonnulls(item_id, look_id) = 1)
      );
      CREATE INDEX closet_photos_item ON closet_photos (item_id, position) WHERE item_id IS NOT NULL;
      CREATE INDEX closet_photos_look ON closet_photos (look_id) WHERE look_id IS NOT NULL;
      -- The household's photo bytes, summed before every upload (a soft cap of 1 GB, a hard 2 GB).
      CREATE INDEX closet_photos_household ON closet_photos (household_id) INCLUDE (bytes);

      -- The calendar: a day someone wore a look or some pieces (or planned to: planned ones don't
      -- count as worn). Pieces by id, so a deleted piece leaves the day as it was.
      CREATE TABLE closet_wears (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        worn_on date NOT NULL,
        look_id uuid REFERENCES closet_looks(id) ON DELETE SET NULL,
        item_ids uuid[] NOT NULL DEFAULT '{}',
        note text NOT NULL DEFAULT '',
        planned boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX closet_wears_owner ON closet_wears (household_id, owner_id, worn_on);
      CREATE INDEX closet_wears_items ON closet_wears USING gin (item_ids);

      -- Packing lists: a trip, the pieces going (ticked when packed) and the looks they came from.
      CREATE TABLE closet_trips (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        destination text NOT NULL DEFAULT '',
        starts_on date,
        ends_on date,
        notes text NOT NULL DEFAULT '',
        look_ids uuid[] NOT NULL DEFAULT '{}',
        back_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX closet_trips_owner ON closet_trips (household_id, owner_id, starts_on);
      CREATE TABLE closet_trip_items (
        trip_id uuid NOT NULL REFERENCES closet_trips(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES closet_items(id) ON DELETE CASCADE,
        packed boolean NOT NULL DEFAULT false,
        position integer NOT NULL DEFAULT 0,
        PRIMARY KEY (trip_id, item_id)
      );
    `,
  },
  {
    version: 42,
    name: 'closet: vacuum bags',
    sql: `
      -- A vacuum bag is a place (in a room, furniture, shelf or box); pieces in one are stored 'vacuum'.
      -- closet_items.storage is free text, so only the place kinds are constrained.
      ALTER TABLE closet_places DROP CONSTRAINT closet_places_kind_check;
      ALTER TABLE closet_places ADD CONSTRAINT closet_places_kind_check CHECK (kind IN ('room',
        'furniture', 'shelf', 'rail', 'drawer', 'box', 'vacuum_bag', 'hook', 'section'));
    `,
  },
  {
    version: 43,
    name: 'closet: vector drawing requests',
    sql: `
      -- Set when someone asks Claude to draw the piece as a vector; cleared when the drawing arrives.
      ALTER TABLE closet_items ADD COLUMN vector_requested_at timestamptz;
    `,
  },
  {
    version: 44,
    name: 'closet: virtual try-on',
    sql: `
      -- Which store mannequin a person's try-ons dress ('male' or 'female'); NULL: ask on the first try-on.
      ALTER TABLE users ADD COLUMN closet_mannequin text CHECK (closet_mannequin IN ('male', 'female'));
      -- '' (idle), 'running', or 'failed: <short reason>' for the last try-on of the piece.
      ALTER TABLE closet_items ADD COLUMN tryon_status text NOT NULL DEFAULT '';
      ALTER TABLE closet_photos DROP CONSTRAINT closet_photos_kind_check;
      ALTER TABLE closet_photos ADD CONSTRAINT closet_photos_kind_check
        CHECK (kind IN ('front', 'back', 'label', 'detail', 'backdrop', 'tryon'));
    `,
  },
  {
    version: 45,
    name: 'medication: the medicine cabinet, treatments, doses taken and expiry alerts',
    sql: `
      -- A medicine the household keeps: shared by default, or one person's (owner_id).
      CREATE TABLE medication_medicines (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
        name text NOT NULL,
        substance text NOT NULL DEFAULT '',
        strength text NOT NULL DEFAULT '',
        form text NOT NULL DEFAULT 'tablet'
          CHECK (form IN ('tablet', 'capsule', 'syrup', 'drops', 'spray', 'cream', 'injection', 'sachet', 'other')),
        -- What quantities count: pcs (tablets, capsules, sachets, ampoules), ml, g, doses (sprays).
        unit text NOT NULL DEFAULT 'pcs' CHECK (unit IN ('pcs', 'ml', 'g', 'doses')),
        rx boolean NOT NULL DEFAULT false,
        color text NOT NULL DEFAULT '',
        shape text NOT NULL DEFAULT '',
        notes text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX medication_medicines_household ON medication_medicines (household_id, lower(name));

      -- A stock lot: a box, blister, bottle or tube, with its own expiry and count.
      CREATE TABLE medication_packages (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        medicine_id uuid NOT NULL REFERENCES medication_medicines(id) ON DELETE CASCADE,
        kind text NOT NULL DEFAULT 'box' CHECK (kind IN ('box', 'blister', 'bottle', 'tube')),
        quantity numeric(10, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        original numeric(10, 3) NOT NULL DEFAULT 0,
        expires_on date,
        -- Printed as a month only: expires_on is its last day.
        expiry_month_only boolean NOT NULL DEFAULT false,
        batch text NOT NULL DEFAULT '',
        opened_on date,
        use_within_days integer CHECK (use_within_days IS NULL OR use_within_days > 0),
        place text NOT NULL DEFAULT '',
        -- expired is worked out from the dates, never stored.
        status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'finished', 'discarded')),
        -- The most urgent expiry alert already sent (90, 30, 7 or 0 days), so each is sent once.
        alerted_level integer,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX medication_packages_medicine ON medication_packages (medicine_id, status);
      CREATE INDEX medication_packages_household ON medication_packages (household_id, status, expires_on);

      CREATE TABLE medication_photos (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        medicine_id uuid NOT NULL REFERENCES medication_medicines(id) ON DELETE CASCADE,
        position integer NOT NULL DEFAULT 0,
        kind text NOT NULL DEFAULT 'front' CHECK (kind IN ('front', 'back', 'blister', 'leaflet', 'other')),
        mime text NOT NULL,
        "full" bytea NOT NULL,
        thumb bytea NOT NULL,
        width integer,
        height integer,
        bytes integer NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX medication_photos_medicine ON medication_photos (medicine_id, position);

      -- A course or schedule of one medicine for one person.
      CREATE TABLE medication_treatments (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        medicine_id uuid NOT NULL REFERENCES medication_medicines(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        dose numeric(10, 3) NOT NULL CHECK (dose > 0),
        kind text NOT NULL CHECK (kind IN ('times', 'interval', 'prn')),
        times text[] NOT NULL DEFAULT '{}',
        weekdays integer[] NOT NULL DEFAULT '{}',
        interval_hours integer CHECK (interval_hours IS NULL OR interval_hours BETWEEN 1 AND 72),
        max_per_day integer CHECK (max_per_day IS NULL OR max_per_day > 0),
        start_on date NOT NULL,
        end_kind text NOT NULL DEFAULT 'none' CHECK (end_kind IN ('none', 'date', 'days', 'doses')),
        end_on date,
        end_days integer,
        end_doses integer,
        stopped_on date,
        instructions text[] NOT NULL DEFAULT '{}',
        notes text NOT NULL DEFAULT '',
        low_days integer NOT NULL DEFAULT 5,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX medication_treatments_household ON medication_treatments (household_id, person_id);
      CREATE INDEX medication_treatments_medicine ON medication_treatments (medicine_id);

      -- One dose: generated per day from the schedule (due_time set), or an as-needed intake
      -- (due_time NULL, taken straight away).
      CREATE TABLE medication_doses (
        id uuid PRIMARY KEY,
        household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        treatment_id uuid NOT NULL REFERENCES medication_treatments(id) ON DELETE CASCADE,
        medicine_id uuid NOT NULL REFERENCES medication_medicines(id) ON DELETE CASCADE,
        person_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        due_on date NOT NULL,
        due_time text,
        status text NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'taken', 'skipped')),
        amount numeric(10, 3) NOT NULL,
        taken_at timestamptz,
        skip_reason text NOT NULL DEFAULT '',
        snoozed_until timestamptz,
        notified_at timestamptz,
        renotified_at timestamptz,
        -- Which packages the dose came out of and how much: [{ "id": "…", "amount": 1 }], for undo.
        deductions jsonb NOT NULL DEFAULT '[]'::jsonb,
        shortfall numeric(10, 3) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX medication_doses_slot ON medication_doses (treatment_id, due_on, due_time)
        WHERE due_time IS NOT NULL;
      CREATE INDEX medication_doses_day ON medication_doses (household_id, due_on);
      CREATE INDEX medication_doses_person ON medication_doses (person_id, due_on);

      -- What the reminder clock already sent today (one digest, one message per dose and again).
      CREATE TABLE medication_notified (
        key text PRIMARY KEY,
        sent_at timestamptz NOT NULL
      );
    `,
  },
];

/** Applies pending migrations. An advisory lock keeps two starting processes from racing. */
export async function migrate(
  db: Database,
  log: (message: string) => void = () => undefined,
): Promise<void> {
  await db.tx(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(727274)');
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version integer PRIMARY KEY,
         name text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const { rows } = await client.query<{ version: number }>(
      'SELECT version FROM schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.version));
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
        migration.version,
        migration.name,
      ]);
      log(`applied migration ${migration.version}: ${migration.name}`);
    }
  });
}

/** Removes expired sessions and rate-limit windows (run hourly by the server). */
export async function cleanup(db: Database, now: Date): Promise<void> {
  await db.query('DELETE FROM rate_limits WHERE expires_at < $1::timestamptz', [now]);
  // Revoked or expired sessions are kept a month, then dropped.
  await db.query(
    `DELETE FROM sessions WHERE expires_at < $1::timestamptz - interval '30 days' OR revoked_at < $1::timestamptz - interval '30 days'`,
    [now],
  );
  await db.query(`DELETE FROM audit_log WHERE created_at < $1::timestamptz - interval '365 days'`, [
    now,
  ]);
  // Sign-in codes live ten minutes; an assistant registered but never connected, a day.
  await db.query(`DELETE FROM oauth_codes WHERE expires_at < $1::timestamptz - interval '1 day'`, [
    now,
  ]);
  await db.query(
    `DELETE FROM oauth_clients c WHERE created_at < $1::timestamptz - interval '1 day'
       AND NOT EXISTS (SELECT 1 FROM api_tokens t WHERE t.oauth_client_id = c.id)`,
    [now],
  );
}
