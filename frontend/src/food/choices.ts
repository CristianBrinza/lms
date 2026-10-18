import type { IngredientLine, PartKind, Recipe, RecipeChoice, RecipeOption } from './types';

/**
 * Recipe choices (Drink: creamy coffee or tea) on the client: which option is in use, the lines
 * that will be used, and what to send. The server says which option each choice uses for the
 * picks it was asked with; these keep the page, cook mode and "Cook now" in the same order.
 */

/** The option a choice is using. */
export function chosenOption(choice: RecipeChoice): RecipeOption | undefined {
  return choice.options.find((o) => o.id === choice.chosen) ?? choice.options[0];
}

/** Picks as the API takes them: option ids, in the recipe's order of choices, valid ones only. */
export function pickedIds(
  choices: Array<Pick<RecipeChoice, 'id' | 'options'>>,
  picks: Record<string, string>,
): string[] {
  return choices.flatMap((choice) => {
    const id = picks[choice.id];
    return id && choice.options.some((o) => o.id === id) ? [id] : [];
  });
}

/**
 * The lines that will be used: the recipe's own, then of each choice the option in use — the
 * order a meal copies them in, so positions match what "Cook now" picks alternatives by.
 */
export function linesInUse(recipe: Pick<Recipe, 'ingredients' | 'choices'>): IngredientLine[] {
  return [
    ...recipe.ingredients,
    ...recipe.choices.flatMap((choice) => chosenOption(choice)?.ingredients ?? []),
  ];
}

/** The alternatives picked, by position among the lines in use (for "Cook now"). */
export function cookChoices(lines: IngredientLine[]): Record<string, number> {
  return Object.fromEntries(
    lines.flatMap((line, index) =>
      line.alternatives.length ? [[String(index), line.chosen]] : [],
    ),
  );
}

/** The recipe's steps, then each option in use's own, as one list (for cook mode). */
export function stepsInUse(
  steps: string[],
  choices: RecipeChoice[],
  stepsOf: (option: RecipeOption) => string[],
): string[] {
  return [
    ...steps,
    ...choices.flatMap((choice) => {
      const option = chosenOption(choice);
      return option ? stepsOf(option) : [];
    }),
  ];
}

/** An optional line of a planned meal shows as on unless it was switched off. */
export const isIncluded = (line: Pick<IngredientLine, 'included'>) => line.included !== false;

/** Options picked in a URL (?options=a,b), for the add-meal sheet opened from a recipe. */
export const parseOptions = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

/** A meal's sections in eating order: first course, second (dish), side, sauce, dessert, drinks. */
export const COURSE_ORDER: PartKind[] = ['first', 'dish', 'side', 'sauce', 'dessert', 'drink'];

/**
 * Lines and choices by section, in eating order; what names no section comes first, without a
 * heading. Only sections with something in them.
 */
export function sectionsOf<
  L extends { course: PartKind | null },
  C extends { course: PartKind | null },
>(lines: L[], choices: C[]): Array<{ course: PartKind | null; lines: L[]; choices: C[] }> {
  return [null, ...COURSE_ORDER]
    .map((course) => ({
      course,
      lines: lines.filter((line) => (line.course ?? null) === course),
      choices: choices.filter((choice) => (choice.course ?? null) === course),
    }))
    .filter((section) => section.lines.length || section.choices.length);
}
