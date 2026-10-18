import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { LOCALES, mergeTranslations, type Translations } from '../../lib/i18n';
import {
  appendIngredientRows,
  resolveIngredients,
  type IngredientRow,
} from './ingredients';
import type { FoodCtx } from './kitchen';
import { withoutField } from './products';
import type { Course, RecipeChoiceInput } from './schemas';
import { round } from './units';

/**
 * Choices: parts of a recipe made one way or another — breakfast's "Drink" is a creamy coffee or a
 * tea. Each option has its own lines (and steps). The recipe's own lines are always used; of each
 * choice, one option: the one picked, else the one picked last time, else the first. A meal copies
 * only the chosen options' lines, so availability, the plan, shopping, nutrition and cooking all
 * see just what will be made, and it can switch an option later (its lines are swapped).
 */

export interface OptionRow {
  id: string;
  choice_id: string;
  name: string;
  steps: string[];
  translations: Translations;
  sort: number;
}

export interface ChoiceRow {
  id: string;
  recipe_id: string;
  name: string;
  translations: Translations;
  sort: number;
  /** The section of the meal it is in (drink); its options' lines go there. */
  course: Course | null;
  /** Picked last time (planned, switched or cooked): the default next time. */
  last_option_id: string | null;
  options: OptionRow[];
}

/** Each recipe's choices with their options, in order. */
export async function choicesOf(
  ctx: FoodCtx,
  recipeIds: string[],
): Promise<Map<string, ChoiceRow[]>> {
  const map = new Map<string, ChoiceRow[]>();
  const ids = [...new Set(recipeIds)];
  if (!ids.length) return map;
  const { rows: choices } = await ctx.db.query<Omit<ChoiceRow, 'options'>>(
    `SELECT id, recipe_id, name, translations, sort, course, last_option_id FROM recipe_choices
      WHERE recipe_id = ANY($1::uuid[]) ORDER BY sort, id`,
    [ids],
  );
  if (!choices.length) return map;
  const { rows: options } = await ctx.db.query<OptionRow>(
    `SELECT id, choice_id, name, steps, translations, sort FROM recipe_options
      WHERE choice_id = ANY($1::uuid[]) ORDER BY sort, id`,
    [choices.map((c) => c.id)],
  );
  for (const choice of choices) {
    const row: ChoiceRow = {
      ...choice,
      translations: choice.translations ?? {},
      options: options
        .filter((o) => o.choice_id === choice.id)
        .map((o) => ({ ...o, translations: o.translations ?? {} })),
    };
    map.set(choice.recipe_id, [...(map.get(choice.recipe_id) ?? []), row]);
  }
  return map;
}

const fold = (value: string) => value.trim().toLocaleLowerCase();

/** An option by id, or by its name in any language ("Tea", "Ceai", "Чай"). */
function matches(option: Pick<OptionRow, 'id' | 'name' | 'translations'>, ref: string): boolean {
  if (option.id === ref) return true;
  const wanted = fold(ref);
  if (fold(option.name) === wanted) return true;
  return LOCALES.some((locale) => {
    const name = option.translations[locale]?.name;
    return typeof name === 'string' && fold(name) === wanted;
  });
}

/** The choice and option a reference (id or name) points to, if the recipe has it. */
export function findOption(
  choices: ChoiceRow[],
  ref: string,
): { choice: ChoiceRow; option: OptionRow } | null {
  for (const choice of choices) {
    const option = choice.options.find((o) => matches(o, ref));
    if (option) return { choice, option };
  }
  return null;
}

/**
 * The option each choice takes (choice id → option id): the one picked, else the one picked last
 * time, else the first. A pick the recipe has no option for is refused.
 */
export function pickOptions(choices: ChoiceRow[], picks: string[] = []): Map<string, string> {
  const picked = new Map<string, string>();
  for (const ref of picks) {
    let found = false;
    for (const choice of choices) {
      const option = choice.options.find((o) => matches(o, ref));
      if (!option) continue;
      picked.set(choice.id, option.id);
      found = true;
    }
    if (!found)
      throw new AppError(400, 'VALIDATION', `This recipe has no option “${ref}”`, {
        fields: { options: `No option “${ref}”` },
      });
  }
  const out = new Map<string, string>();
  for (const choice of choices) {
    const first = choice.options[0];
    if (!first) continue;
    const remembered = choice.options.find((o) => o.id === choice.last_option_id);
    out.set(choice.id, picked.get(choice.id) ?? remembered?.id ?? first.id);
  }
  return out;
}

/** The chosen option ids, in the recipe's order of choices. */
export function chosenIds(choices: ChoiceRow[], picked: Map<string, string>): string[] {
  return choices.flatMap((choice) => {
    const id = picked.get(choice.id);
    return id ? [id] : [];
  });
}

/** Option lines take their choice's section unless they name their own. */
export function withChoiceCourses<T extends IngredientRow>(rows: T[], choices: ChoiceRow[]): T[] {
  const courses = new Map(
    choices.flatMap((choice) => choice.options.map((o) => [o.id, choice.course] as const)),
  );
  return rows.map((row) =>
    row.option_id && !row.course ? { ...row, course: courses.get(row.option_id) ?? null } : row,
  );
}

/** Remembers what was picked, so it is the default next time. */
export async function rememberOptions(ctx: FoodCtx, optionIds: string[]): Promise<void> {
  if (!optionIds.length) return;
  await ctx.db.query(
    `UPDATE recipe_choices c SET last_option_id = o.id FROM recipe_options o
      WHERE o.id = ANY($1::uuid[]) AND c.id = o.choice_id`,
    [optionIds],
  );
}

/** A recipe line as a meal's copy: scaled, with its alternatives' amounts scaled too. */
export function scaledCopy(
  row: IngredientRow,
  scale: number,
): Omit<IngredientRow, 'id' | 'owner_id'> {
  return {
    product_id: row.product_id,
    lot_id: null,
    option_id: row.option_id ?? null,
    course: row.course ?? null,
    translations: row.translations ?? {},
    name: row.name,
    variant: row.variant ?? '',
    alternatives: (row.alternatives ?? []).map((alt) => ({
      ...alt,
      amount: alt.amount === null ? null : round(alt.amount * scale),
    })),
    amount: row.amount === null ? null : round(row.amount * scale),
    unit: row.unit,
    note: row.note,
    optional: row.optional,
    sort: row.sort,
  };
}

/** A field rewritten in its own language: its old translations no longer fit, unless given anew. */
function keptTranslations(
  stored: Translations | undefined,
  changed: string[],
  update: Translations | undefined,
): string {
  let base = stored ?? {};
  for (const field of changed) base = withoutField(base, field);
  return JSON.stringify(mergeTranslations(base, update));
}

/** Names the lines' errors by where they are in the recipe: choices.0.options.1.ingredients.2.unit. */
async function resolveOptionLines(
  ctx: FoodCtx,
  input: RecipeChoiceInput['options'][number],
  where: string,
) {
  try {
    return await resolveIngredients(ctx, input.ingredients ?? []);
  } catch (error) {
    if (error instanceof AppError && error.fields) {
      throw new AppError(error.status, error.code, error.message, {
        fields: Object.fromEntries(
          Object.entries(error.fields).map(([key, value]) => [`${where}.${key}`, value]),
        ),
      });
    }
    throw error;
  }
}

/**
 * Replaces a recipe's choices. A choice or option sent back with its id (or, without one, under
 * the same name) is kept — what was picked last time stays the default — the rest are new, and
 * those not sent are removed. Each option's lines are replaced by the ones given.
 */
export async function saveChoices(
  ctx: FoodCtx,
  recipeId: string,
  inputs: RecipeChoiceInput[],
): Promise<void> {
  const existing = (await choicesOf(ctx, [recipeId])).get(recipeId) ?? [];
  const keptChoices: string[] = [];
  for (const [i, input] of inputs.entries()) {
    const names = input.options.map((o) => fold(o.name));
    const twice = names.findIndex((name, index) => names.indexOf(name) !== index);
    if (twice >= 0)
      throw new AppError(400, 'VALIDATION', 'Two options have the same name', {
        fields: { [`choices.${i}.options.${twice}.name`]: 'Already an option' },
      });
    const old =
      existing.find((c) => c.id === input.id && !keptChoices.includes(c.id)) ??
      (input.id
        ? undefined
        : existing.find((c) => fold(c.name) === fold(input.name) && !keptChoices.includes(c.id)));
    const choiceId = old?.id ?? randomUUID();
    const choiceTranslations = keptTranslations(
      old?.translations,
      old && old.name !== input.name ? ['name'] : [],
      input.translations,
    );
    if (old) {
      await ctx.db.query(
        'UPDATE recipe_choices SET name = $2, translations = $3::jsonb, sort = $4, course = $5 WHERE id = $1',
        [choiceId, input.name, choiceTranslations, i, input.course ?? null],
      );
    } else {
      await ctx.db.query(
        'INSERT INTO recipe_choices (id, recipe_id, name, translations, sort, course) VALUES ($1, $2, $3, $4::jsonb, $5, $6)',
        [choiceId, recipeId, input.name, choiceTranslations, i, input.course ?? null],
      );
    }
    keptChoices.push(choiceId);
    const keptOptions: string[] = [];
    for (const [j, option] of input.options.entries()) {
      const before =
        old?.options.find((o) => o.id === option.id && !keptOptions.includes(o.id)) ??
        (option.id
          ? undefined
          : old?.options.find(
              (o) => fold(o.name) === fold(option.name) && !keptOptions.includes(o.id),
            ));
      const optionId = before?.id ?? randomUUID();
      const steps = option.steps ?? [];
      const optionTranslations = keptTranslations(
        before?.translations,
        [
          ...(before && before.name !== option.name ? ['name'] : []),
          ...(before && before.steps.join('\n') !== steps.join('\n') ? ['steps'] : []),
        ],
        option.translations,
      );
      const lines = await resolveOptionLines(ctx, option, `choices.${i}.options.${j}`);
      if (before) {
        await ctx.db.query(
          'UPDATE recipe_options SET name = $2, steps = $3, translations = $4::jsonb, sort = $5 WHERE id = $1',
          [optionId, option.name, steps, optionTranslations, j],
        );
        await ctx.db.query('DELETE FROM recipe_ingredients WHERE option_id = $1', [optionId]);
      } else {
        await ctx.db.query(
          'INSERT INTO recipe_options (id, choice_id, name, steps, translations, sort) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
          [optionId, choiceId, option.name, steps, optionTranslations, j],
        );
      }
      await appendIngredientRows(
        ctx,
        'recipe_ingredients',
        recipeId,
        lines.map((line) => ({ ...line, option_id: optionId })),
      );
      keptOptions.push(optionId);
    }
    // Options no longer there go, with their lines; a meal that used one keeps its copy.
    await ctx.db.query(
      'DELETE FROM recipe_options WHERE choice_id = $1 AND NOT (id = ANY($2::uuid[]))',
      [choiceId, keptOptions],
    );
  }
  await ctx.db.query(
    'DELETE FROM recipe_choices WHERE recipe_id = $1 AND NOT (id = ANY($2::uuid[]))',
    [recipeId, keptChoices],
  );
}
