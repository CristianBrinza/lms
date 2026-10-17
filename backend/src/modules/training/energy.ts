import type { Locale } from '../../lib/i18n';
import type { FoodCtx as Ctx } from '../food/kitchen';
import { addNutrients, nutrientsIn, roundNutrients, type Nutrients } from '../food/nutrition';
import { productsByIds } from '../food/products';
import { localDate } from '../food/stock';
import { age } from '../profile';
import { CATEGORY_MET, EXERCISE_ENERGY, REST_MET, runningMet, walkingMet } from './energy-data';
import { energyText, num } from './i18n';
import { addDays } from './stats';

/**
 * Energy in and out, per person and day, from published formulas — nothing made up:
 *
 * - Burned at rest: the phone's resting energy (Apple Health, Health Connect), else the
 *   Mifflin–St Jeor equation (1990) from weight, height, age and sex.
 * - Moving through the day: the phone's active energy, else a light-activity allowance from the
 *   person's activity level (FAO/WHO/UNU physical activity levels).
 * - Training logged here: METs from the 2024 Adult Compendium of Physical Activities × body weight
 *   × time (walking and running by the ACSM equations when distance and time are known). Only the
 *   part above rest counts on top (MET − 1), so nothing is counted twice. Workouts brought in from
 *   the phone are already in its active energy.
 * - Eaten: the meals the person ate (one serving each), from the food's nutrition.
 * - A target from the goal: losing ~0.5 kg a week is ~550 kcal a day under what is burned
 *   (7700 kcal per kg of body fat), never below what rest needs; protein 1.2–1.6 g per kg (more
 *   when training) — ISSN / ACSM position stands.
 * - After two weeks of meals and weigh-ins, what was actually burned is measured from the two
 *   (intake − weight change × 7700 / days), the way adaptive apps do.
 */

export type Goal = 'lose' | 'keep' | 'gain';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';

/** Physical activity level without exercise (FAO/WHO/UNU 2004): 1.2 desk-bound … 1.9 very active. */
const PAL: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
};
const KCAL_PER_KG = 7700;

export interface Person {
  weight: number | null;
  weightDay: string | null;
  heightCm: number | null;
  age: number | null;
  gender: 'female' | 'male' | 'other' | null;
  goal: Goal | null;
  goalWeight: number | null;
  goalRate: number | null;
  activity: Activity;
}

async function personOf(ctx: Ctx, userId: string, day: string): Promise<Person> {
  const { rows } = await ctx.db.query<{
    gender: Person['gender'];
    birth_date: string | null;
    height_cm: number | null;
    goal: Goal | null;
    goal_weight: string | null;
    goal_rate: string | null;
    activity: Activity | null;
  }>(
    'SELECT gender, birth_date::text AS birth_date, height_cm, goal, goal_weight, goal_rate, activity FROM users WHERE id = $1',
    [userId],
  );
  const weight = await ctx.db.query<{ value: string; day: string }>(
    `SELECT value, day::text AS day FROM health_days WHERE user_id = $1 AND kind = 'weight' AND day <= $2 ORDER BY day DESC, source LIMIT 1`,
    [userId, day],
  );
  const row = rows[0]!;
  return {
    weight: weight.rows[0] ? Number(weight.rows[0].value) : null,
    weightDay: weight.rows[0]?.day ?? null,
    heightCm: row.height_cm,
    age: age(row.birth_date, new Date(`${day}T12:00:00`)),
    gender: row.gender,
    goal: row.goal,
    goalWeight: row.goal_weight === null ? null : Number(row.goal_weight),
    goalRate: row.goal_rate === null ? null : Number(row.goal_rate),
    activity: row.activity ?? 'light',
  };
}

/** The weight to count with: the person's latest, else 70 kg (and the summary says so). */
const kgOf = (p: Person) => p.weight ?? 70;

/** Mifflin–St Jeor (1990): 10·kg + 6.25·cm − 5·age + 5 (men) / −161 (women); "other" halfway. */
export function bmr(p: Pick<Person, 'weight' | 'heightCm' | 'age' | 'gender'>): number | null {
  if (!p.weight || !p.heightCm || p.age === null) return null;
  const s = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  return Math.round(10 * p.weight + 6.25 * p.heightCm - 5 * p.age + s);
}

// ---------------------------------------------------------------- training

export interface SetForEnergy {
  preset: string | null;
  category: keyof typeof CATEGORY_MET;
  measure: 'reps' | 'time' | 'distance';
  unilateral: boolean;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
  effort: number | null;
  side: 'left' | 'right' | null;
}

/** How long a set took: its own time, else reps at the exercise's usual pace. */
export function setSeconds(set: SetForEnergy): number {
  if (set.seconds) return set.seconds;
  const entry = set.preset ? EXERCISE_ENERGY[set.preset] : undefined;
  if (set.reps) return set.reps * (entry?.secondsPerRep ?? 3);
  if (set.distance) return set.distance / (set.preset === 'walk' ? 80 : 160);
  return 0;
}

/** The MET of a set: running and walking from their speed (ACSM), the rest from the Compendium. */
export function setMet(set: SetForEnergy): number {
  if (
    set.distance &&
    set.seconds &&
    (set.preset === 'run' || set.preset === 'walk' || set.preset === 'intervals-run')
  ) {
    const speed = set.distance / (set.seconds / 60);
    return speed > 134 ? runningMet(speed) : walkingMet(speed);
  }
  const entry = set.preset ? EXERCISE_ENERGY[set.preset] : undefined;
  if (!entry) return CATEGORY_MET[set.category] ?? 3.5;
  return set.effort !== null && set.effort >= 8 && entry.metVigorous
    ? entry.metVigorous
    : entry.met;
}

/** kcal of one set, all of it (gross: MET × kg × hours). */
export function setKcal(set: SetForEnergy, kg: number): number {
  return (setMet(set) * kg * setSeconds(set)) / 3600;
}

/**
 * A person's training kcal on days, from the sets logged here (not those brought in from the
 * phone): gross per workout (what a workout "cost"), and net (above rest) for the day's balance.
 * A done workout's time beyond its sets counts as rest between sets.
 */
async function trainingByDay(
  ctx: Ctx,
  userId: string,
  from: string,
  to: string,
  kg: number,
): Promise<Map<string, { gross: number; net: number; minutes: number }>> {
  const { rows } = await ctx.db.query<SetForEnergy & { day: string; workout_id: string | null }>(
    `SELECT s.day::text AS day, s.workout_id, e.preset, e.category, e.measure, e.unilateral, s.reps, s.seconds, s.distance, s.effort, s.side
       FROM training_sets s JOIN training_exercises e ON e.id = s.exercise_id
      WHERE s.household_id = $1 AND s.user_id = $2 AND s.day BETWEEN $3 AND $4 AND (s.external_id IS NULL OR s.external_id LIKE 'app:%')`,
    [ctx.actor.householdId, userId, from, to],
  );
  const workouts = await ctx.db.query<{ id: string; day: string; duration_seconds: number | null }>(
    `SELECT id, date::text AS day, duration_seconds FROM training_workouts WHERE household_id = $1 AND user_id = $2 AND status = 'done' AND date BETWEEN $3 AND $4`,
    [ctx.actor.householdId, userId, from, to],
  );
  const out = new Map<string, { gross: number; net: number; minutes: number }>();
  const work = new Map<string, number>();
  for (const set of rows) {
    const seconds = setSeconds(set);
    const met = setMet(set);
    const entry = out.get(set.day) ?? { gross: 0, net: 0, minutes: 0 };
    entry.gross += (met * kg * seconds) / 3600;
    entry.net += (Math.max(0, met - 1) * kg * seconds) / 3600;
    entry.minutes += seconds / 60;
    out.set(set.day, entry);
    if (set.workout_id) work.set(set.workout_id, (work.get(set.workout_id) ?? 0) + seconds);
  }
  for (const w of workouts.rows) {
    if (!w.duration_seconds) continue;
    const rest = Math.max(0, w.duration_seconds - (work.get(w.id) ?? 0));
    const entry = out.get(w.day) ?? { gross: 0, net: 0, minutes: 0 };
    entry.gross += (REST_MET * kg * rest) / 3600;
    entry.net += ((REST_MET - 1) * kg * rest) / 3600;
    entry.minutes += rest / 60;
    out.set(w.day, entry);
  }
  return out;
}

/** A workout's kcal (gross), from its sets and its time. */
export async function workoutKcal(
  ctx: Ctx,
  workoutId: string,
  userId: string,
  durationSeconds: number | null,
): Promise<number> {
  const { rows } = await ctx.db.query<SetForEnergy>(
    `SELECT e.preset, e.category, e.measure, e.unilateral, s.reps, s.seconds, s.distance, s.effort, s.side
       FROM training_sets s JOIN training_exercises e ON e.id = s.exercise_id WHERE s.workout_id = $1`,
    [workoutId],
  );
  const kg = kgOf(await personOf(ctx, userId, localDate(ctx.now)));
  const work = rows.reduce((sum, s) => sum + setSeconds(s), 0);
  const sets = rows.reduce((sum, s) => sum + setKcal(s, kg), 0);
  const rest = durationSeconds ? Math.max(0, durationSeconds - work) : 0;
  return Math.round(sets + (REST_MET * kg * rest) / 3600);
}

// ---------------------------------------------------------------- eaten

interface MealLineRow {
  meal_id: string;
  product_id: string | null;
  amount: string | null;
  unit: string | null;
  variant: string | null;
  choice: number | null;
  alternatives: Array<{
    product_id?: string | null;
    productId?: string | null;
    amount: number | null;
    unit: string | null;
    variant?: string;
  }> | null;
}

/** What one person ate on each day: their serving of every meal they ate (and kcal eaten out). */
async function eatenByDay(
  ctx: Ctx,
  userId: string,
  from: string,
  to: string,
): Promise<Map<string, { nutrients: Nutrients; meals: number; unknown: number }>> {
  const people = await ctx.db.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM users WHERE household_id = $1 AND is_active',
    [ctx.actor.householdId],
  );
  const household = people.rows[0]?.count ?? 1;
  const { rows: meals } = await ctx.db.query<{
    id: string;
    day: string;
    servings: number;
    eaters: string[];
    done_by: string | null;
    created_by: string | null;
    out_kind: string | null;
    out_kcal: number | null;
  }>(
    `SELECT id, date::text AS day, servings, eaters, done_by, created_by, out_kind, out_kcal FROM meals
      WHERE household_id = $1 AND status = 'done' AND date BETWEEN $2 AND $3`,
    [ctx.actor.householdId, from, to],
  );
  // Whose a meal was: those named; else everyone when there's a serving each; else who marked it eaten.
  const mine = meals.filter((m) =>
    m.eaters.length
      ? m.eaters.includes(userId)
      : m.servings >= household
        ? true
        : (m.done_by ?? m.created_by) === userId,
  );
  const out = new Map<string, { nutrients: Nutrients; meals: number; unknown: number }>();
  const entry = (day: string) =>
    out.get(day) ?? { nutrients: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, meals: 0, unknown: 0 };
  const cooked = mine.filter((m) => !m.out_kind);
  for (const m of mine.filter((x) => x.out_kind)) {
    const e = entry(m.day);
    e.meals++;
    if (m.out_kcal)
      e.nutrients = addNutrients(e.nutrients, { kcal: m.out_kcal, protein: 0, fat: 0, carbs: 0 });
    else e.unknown++;
    out.set(m.day, e);
  }
  if (!cooked.length) return out;
  const { rows: lines } = await ctx.db.query<MealLineRow>(
    `SELECT meal_id, product_id, amount, unit, variant, choice, alternatives FROM meal_ingredients WHERE meal_id = ANY($1::uuid[]) AND NOT optional`,
    [cooked.map((m) => m.id)],
  );
  const ids = new Set<string>();
  for (const l of lines) {
    if (l.product_id) ids.add(l.product_id);
    for (const a of l.alternatives ?? [])
      if (a.product_id ?? a.productId) ids.add((a.product_id ?? a.productId)!);
  }
  const products = new Map((await productsByIds(ctx, [...ids])).map((p) => [p.id, p]));
  for (const m of cooked) {
    const e = entry(m.day);
    e.meals++;
    let total: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    for (const l of lines.filter((x) => x.meal_id === m.id)) {
      const alt = l.choice && l.choice > 0 ? l.alternatives?.[l.choice - 1] : undefined;
      const productId = alt ? (alt.product_id ?? alt.productId ?? null) : l.product_id;
      const amount = alt ? alt.amount : l.amount === null ? null : Number(l.amount);
      if (amount === null || !productId) continue;
      const product = products.get(productId);
      const n = product
        ? nutrientsIn(product, amount, alt ? alt.unit : l.unit, alt ? alt.variant : l.variant)
        : null;
      if (n) total = addNutrients(total, n);
      else e.unknown++;
    }
    const share = 1 / Math.max(1, m.servings, m.eaters.length);
    e.nutrients = addNutrients(e.nutrients, total, share);
    out.set(m.day, e);
  }
  return out;
}

// ---------------------------------------------------------------- the summary

export interface EnergyDay {
  day: string;
  eaten: Nutrients | null;
  meals: number;
  /** Lines or meals whose values are unknown that day. */
  unknown: number;
  burned: {
    resting: number;
    active: number;
    training: number;
    total: number;
    source: 'phone' | 'estimate';
  };
  /** Eaten minus burned (negative: a deficit). Null when nothing was eaten (logged). */
  balance: number | null;
}

export interface EnergySummary {
  person: Person & { assumedWeight: boolean; bmr: number | null };
  days: EnergyDay[];
  /** What a day burns: from the last 14 days, and measured from intake and weight when there's enough. */
  burn: { estimated: number; measured: number | null };
  target: { kcal: number; protein: number; fat: number; carbs: number; why: string };
  insights: Array<{ tone: 'good' | 'watch' | 'info'; text: string }>;
}

export async function energySummary(
  ctx: Ctx,
  userId: string,
  from: string,
  to: string,
  today = localDate(ctx.now),
  locale: Locale = 'en',
): Promise<EnergySummary> {
  const t = energyText[locale];
  const person = await personOf(ctx, userId, to);
  const kg = kgOf(person);
  const rest = bmr(person);
  // Two extra weeks before `from` give the burn estimate and the measured burn their history.
  const since = addDays(from, -14) < addDays(to, -27) ? addDays(from, -14) : addDays(to, -27);
  const [phone, training, eaten] = await Promise.all([
    ctx.db.query<{ day: string; kind: string; value: string }>(
      `SELECT DISTINCT ON (day, kind) day::text AS day, kind, value FROM health_days
        WHERE user_id = $1 AND kind IN ('activeEnergy', 'restingEnergy', 'weight') AND day BETWEEN $2 AND $3
        ORDER BY day, kind, CASE source WHEN 'manual' THEN 1 ELSE 0 END, updated_at DESC`,
      [userId, since, to],
    ),
    trainingByDay(ctx, userId, since, to, kg),
    eatenByDay(ctx, userId, since, to),
  ]);
  const phoneOf = (day: string, kind: string) => {
    const row = phone.rows.find((r) => r.day === day && r.kind === kind);
    return row ? Number(row.value) : null;
  };
  const restingFallback = rest ?? Math.round(kg * 22);
  const all: EnergyDay[] = [];
  for (let day = since; day <= to; day = addDays(day, 1)) {
    const resting = phoneOf(day, 'restingEnergy') ?? restingFallback;
    const phoneActive = phoneOf(day, 'activeEnergy');
    const trained = training.get(day);
    const active = phoneActive ?? Math.round(restingFallback * (PAL[person.activity] - 1));
    const extra = Math.round(trained?.net ?? 0);
    const total = Math.round(resting + active + extra);
    const ate = eaten.get(day);
    all.push({
      day,
      eaten: ate ? roundNutrients(ate.nutrients) : null,
      meals: ate?.meals ?? 0,
      unknown: ate?.unknown ?? 0,
      burned: {
        resting: Math.round(resting),
        active: Math.round(active),
        training: extra,
        total,
        source: phoneActive !== null ? 'phone' : 'estimate',
      },
      balance: ate ? Math.round(ate.nutrients.kcal - total) : null,
    });
  }
  const done = all.filter((d) => d.day < today);
  const recent = (done.length ? done : all).slice(-14);
  const estimated = Math.round(
    recent.reduce((s, d) => s + d.burned.total, 0) / Math.max(1, recent.length),
  );

  // Measured burn: average intake minus the weight change's energy, over 14+ days with meals logged on most days.
  let measured: number | null = null;
  const window = done.slice(-28);
  const fed = window.filter((d) => d.eaten && d.unknown === 0);
  const weights = phone.rows
    .filter((r) => r.kind === 'weight' && r.day >= (window[0]?.day ?? to))
    .sort((a, b) => a.day.localeCompare(b.day));
  if (fed.length >= 14 && fed.length >= window.length * 0.8 && weights.length >= 2) {
    const first = weights[0]!;
    const last = weights[weights.length - 1]!;
    const span = Math.max(1, (Date.parse(last.day) - Date.parse(first.day)) / 86_400_000);
    if (span >= 10) {
      const intake = fed.reduce((s, d) => s + d.eaten!.kcal, 0) / fed.length;
      measured = Math.round(
        intake - ((Number(last.value) - Number(first.value)) * KCAL_PER_KG) / span,
      );
    }
  }

  const burn = measured ?? estimated;
  const rate = person.goalRate ?? (person.goal === 'gain' ? 0.25 : 0.5);
  const floor = Math.max(rest ?? 0, person.gender === 'male' ? 1500 : 1200);
  let kcal = burn;
  let why = t.keep;
  if (person.goal === 'lose') {
    kcal = Math.max(floor, Math.round(burn - (rate * KCAL_PER_KG) / 7));
    why = t.lose(num(rate, locale), Math.round((rate * KCAL_PER_KG) / 7), kcal === floor);
  } else if (person.goal === 'gain') {
    kcal = Math.round(burn + (rate * KCAL_PER_KG) / 7);
    why = t.gain(num(rate, locale), Math.round((rate * KCAL_PER_KG) / 7));
  } else if (!person.goal) why = t.noGoal;
  const weekWorkouts = await ctx.db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM training_workouts WHERE user_id = $1 AND status = 'done' AND date > $2::date - 7`,
    [userId, today],
  );
  const training3 = (weekWorkouts.rows[0]?.count ?? 0) >= 2;
  const protein = Math.round(kg * (training3 || person.goal === 'lose' ? 1.6 : 1.2));
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  const shown = all.filter((d) => d.day >= from);
  return {
    person: { ...person, assumedWeight: person.weight === null, bmr: rest },
    days: shown,
    burn: { estimated, measured },
    target: { kcal, protein, fat, carbs, why },
    insights: energyInsights(shown, { kcal, protein }, today, person, measured, locale),
  };
}

function energyInsights(
  days: EnergyDay[],
  target: { kcal: number; protein: number },
  today: string,
  person: Person,
  measured: number | null,
  locale: Locale,
): EnergySummary['insights'] {
  const t = energyText[locale];
  const out: EnergySummary['insights'] = [];
  const day = days.find((d) => d.day === today);
  if (day?.eaten) {
    const left = target.kcal - day.eaten.kcal;
    out.push(
      left >= 0
        ? { tone: 'info', text: t.left(left, target.kcal) }
        : { tone: 'watch', text: t.over(-left, target.kcal) },
    );
    if (day.eaten.protein < target.protein * 0.6 && day.meals >= 2)
      out.push({
        tone: 'watch',
        text: t.protein(Math.round(day.eaten.protein), target.protein),
      });
  }
  const week = days.filter(
    (d) => d.day > addDays(today, -7) && d.day <= today && d.balance !== null,
  );
  if (week.length >= 4) {
    const avg = Math.round(week.reduce((s, d) => s + d.balance!, 0) / week.length);
    const goal = person.goal === 'lose' ? 'lose' : person.goal === 'gain' ? 'gain' : 'keep';
    out.push({ tone: 'info', text: t.week(Math.abs(avg), avg < 0, goal) });
  }
  if (person.weight === null) out.push({ tone: 'watch', text: t.noWeight });
  if (measured !== null) out.push({ tone: 'good', text: t.measured(measured) });
  return out;
}
