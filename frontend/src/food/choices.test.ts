import { describe, expect, it } from 'vitest';
import {
  chosenOption,
  cookChoices,
  isIncluded,
  linesInUse,
  parseOptions,
  pickedIds,
  sectionsOf,
  stepsInUse,
} from './choices';
import type { IngredientLine, RecipeChoice } from './types';

const line = (id: string, extra: Partial<IngredientLine> = {}): IngredientLine => ({
  id,
  productId: null,
  lotId: null,
  partId: null,
  optionId: null,
  course: null,
  included: null,
  variant: '',
  alternatives: [],
  mainEnough: null,
  mainMissing: 0,
  choice: null,
  chosen: 0,
  spoilsBefore: false,
  using: null,
  name: id,
  icon: 'basket',
  amount: null,
  unit: null,
  note: '',
  optional: false,
  inStock: null,
  level: null,
  baseUnit: null,
  enough: null,
  missing: 0,
  reservedFor: null,
  warnings: [],
  expiresSoon: false,
  ...extra,
});

const availability = { have: 0, total: 0, ready: true, missing: [], useSoon: 0, warnings: [] };

const drink: RecipeChoice = {
  course: null,
  id: 'drink',
  name: 'Drink',
  chosen: 'tea',
  remembered: 'tea',
  options: [
    {
      id: 'coffee',
      name: 'Creamy coffee',
      steps: ['Brew'],
      availability,
      ingredients: [line('coffee-beans', { optionId: 'coffee' })],
    },
    {
      id: 'tea',
      name: 'Tea',
      steps: ['Steep'],
      availability,
      ingredients: [
        line('lemon', { optionId: 'tea' }),
        line('sugar', {
          optionId: 'tea',
          chosen: 1,
          alternatives: [
            {
              productId: 'honey',
              name: 'Honey',
              icon: 'honey',
              amount: 10,
              unit: 'g',
              variant: '',
              enough: true,
              missing: 0,
              inStock: 100,
              baseUnit: 'g',
            },
          ],
        }),
      ],
    },
  ],
};

describe('recipe choices', () => {
  it('uses the recipe’s lines, then the option in use, in that order', () => {
    const lines = linesInUse({ ingredients: [line('eggs')], choices: [drink] });
    expect(lines.map((l) => l.id)).toEqual(['eggs', 'lemon', 'sugar']);
    // "Cook now" picks alternatives by position among those lines.
    expect(cookChoices(lines)).toEqual({ '2': 1 });
    expect(chosenOption(drink)?.name).toBe('Tea');
    expect(chosenOption({ ...drink, chosen: 'gone' })?.name).toBe('Creamy coffee');
  });

  it('sends only picks the recipe has, in its order of choices', () => {
    const food: RecipeChoice = { ...drink, id: 'food', options: [drink.options[0]!] };
    expect(pickedIds([drink, food], { food: 'coffee', drink: 'tea', other: 'x' })).toEqual([
      'tea',
      'coffee',
    ]);
    expect(pickedIds([drink], { drink: 'juice' })).toEqual([]);
  });

  it('adds the option’s steps after the recipe’s', () => {
    expect(stepsInUse(['Scramble'], [drink], (o) => o.steps)).toEqual(['Scramble', 'Steep']);
  });

  it('groups lines and choices by section, in eating order, unnamed first', () => {
    const eggs = line('eggs', { course: 'dish' });
    const soup = line('soup', { course: 'first' });
    const bread = line('bread');
    const sections = sectionsOf([eggs, soup, bread], [{ ...drink, course: 'drink' as const }]);
    expect(sections.map((s) => [s.course, s.lines.map((l) => l.id), s.choices.length])).toEqual([
      [null, ['bread'], 0],
      ['first', ['soup'], 0],
      ['dish', ['eggs'], 0],
      ['drink', [], 1],
    ]);
  });

  it('reads options from a link and optional lines as on unless switched off', () => {
    expect(parseOptions('a, b,,')).toEqual(['a', 'b']);
    expect(parseOptions(null)).toEqual([]);
    expect(isIncluded(line('x', { optional: true }))).toBe(true);
    expect(isIncluded(line('x', { optional: true, included: true }))).toBe(true);
    expect(isIncluded(line('x', { optional: true, included: false }))).toBe(false);
  });
});
