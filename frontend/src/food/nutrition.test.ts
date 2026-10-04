import { describe, expect, it } from 'vitest';
import {
  ateIt,
  eatenBy,
  formatGrams,
  formatKcal,
  kcalEach,
  kindValues,
  macroText,
  nutrientsIn,
  parseNutrient,
  readForm,
} from './nutrition';
import type { Meal, NutritionEntry } from './types';

const cola: NutritionEntry = {
  per: '100ml',
  base: { kcal: 42, protein: 0, fat: 0, carbs: 10.6, sugar: 10.6 },
  kinds: { Zero: { kcal: 0, protein: 0, fat: 0, carbs: 0 } },
};
const egg: NutritionEntry = {
  per: 'piece',
  base: { kcal: 78, protein: 6.3, fat: 5.3, carbs: 0.6 },
};

const dish = (kcal: number) => ({
  total: { kcal, protein: 0, fat: 0, carbs: 0 },
  perServing: { kcal, protein: 0, fat: 0, carbs: 0 },
  known: 1,
  counted: 1,
  unknown: [],
});
const meal = (over: Partial<Meal>) =>
  ({
    status: 'done',
    servings: 1,
    eaters: [],
    doneBy: null,
    eatenOut: null,
    nutrition: dish(0),
    ...over,
  }) as Meal;

describe('nutrition', () => {
  it('reads numbers the way people say them', () => {
    expect(formatKcal(1240)).toBe('1 240');
    expect(formatKcal(98.6)).toBe('99');
    expect(formatGrams(4.54)).toBe('4.5 g');
    expect(formatGrams(32.4)).toBe('32 g');
    expect(parseNutrient('4,5')).toBe(4.5);
    expect(parseNutrient('0')).toBe(0);
    expect(parseNutrient('')).toBeNull();
    expect(parseNutrient('-1')).toBeNull();
  });

  it('counts an amount through the item’s units and kinds', () => {
    const bottle = { unit: 'ml' as const, pieceSize: 500, pieceUnit: 'ml' as const };
    expect(nutrientsIn(cola, bottle, 330, 'ml')!.kcal).toBeCloseTo(138.6);
    expect(nutrientsIn(cola, bottle, 1, 'pcs')!.kcal).toBe(210);
    expect(nutrientsIn(cola, bottle, 1, 'pcs', 'zero')!.kcal).toBe(0);
    expect(kindValues(cola, 'Cherry')).toBe(cola.base);
    const eggs = { unit: 'pcs' as const, pieceSize: 60, pieceUnit: 'g' as const };
    expect(nutrientsIn(egg, eggs, 2, 'pcs')!.kcal).toBe(156);
    expect(nutrientsIn(egg, { unit: 'g', pieceSize: null, pieceUnit: null }, 100, 'g')).toBeNull();
  });

  it('gives each person their share of what they ate', () => {
    const me = 'me';
    // Named: only those named, split by servings or eaters, whichever is more.
    expect(ateIt(meal({ eaters: ['ana'] }), me, 3)).toBe(false);
    // Nobody named, a serving each: everyone. Fewer servings: whoever marked it eaten.
    expect(ateIt(meal({ servings: 3 }), me, 3)).toBe(true);
    expect(ateIt(meal({ servings: 1, doneBy: 'ana' }), me, 3)).toBe(false);
    expect(ateIt(meal({ servings: 1, doneBy: me }), me, 3)).toBe(true);
    const day = [
      meal({ servings: 4, nutrition: dish(2000) }), // 500 each
      meal({ eaters: [me, 'ana'], servings: 1, nutrition: dish(600) }), // 300
      meal({ doneBy: me, eatenOut: { kind: 'restaurant', place: '', cost: null, kcal: 800 } }),
      meal({ status: 'planned', servings: 4, nutrition: dish(900) }), // not eaten yet
    ];
    expect(eatenBy(day, me, 3)).toEqual({ kcal: 1600, meals: 3 });
    expect(kcalEach(day[0]!)).toBe(2000);
    expect(kcalEach(meal({ nutrition: { ...dish(0), known: 0 } }))).toBeNull();
  });

  it('reads the editor’s fields', () => {
    expect(readForm({})).toBe('empty');
    expect(readForm({ kcal: ' ', sugar: '' })).toBe('empty');
    expect(readForm({ kcal: '52' })).toBe('missing');
    expect(readForm({ kcal: '52', protein: '0,3', fat: '0.2', carbs: '14', salt: '' })).toEqual({
      kcal: 52,
      protein: 0.3,
      fat: 0.2,
      carbs: 14,
    });
    expect(macroText({ kcal: 1, protein: 32.4, fat: 4.54, carbs: 55, fiber: 2 }, true)).toBe(
      '32 g protein · 4.5 g fat · 55 g carbs · 2 g fibre',
    );
  });
});
