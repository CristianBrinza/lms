/**
 * Typical nutrition per 100 g (items counted in g), per 100 ml (items in ml), or per piece
 * (items counted in pcs with no piece weight, e.g. a tea bag). Values are typical for products
 * sold in Moldova/EU, from USDA FoodData Central and EU labels; a household can override them.
 *
 * Carbs are available carbohydrate, EU-label style: fiber is listed separately, not inside carbs
 * (USDA "carbohydrate by difference" has had its fiber taken out). Energy follows the EU factors
 * (Regulation 1169/2011): protein and carbs 4 kcal/g, fat 9, fiber 2, alcohol 7, organic acids 3.
 * Rice, pasta, grains, legumes and flakes are dry, as stored; meat and fish raw; canned vegetables
 * and legumes drained. Salt is sodium × 2.5. Drinks note their alcohol by volume (ABV).
 *
 * Sources:
 * - USDA FoodData Central, SR Legacy and Foundation Foods (produce, meat, fish, dairy, grains,
 *   nuts, spices, wine, spirits): https://fdc.nal.usda.gov
 * - Open Food Facts, Romanian and EU product pages (Coca-Cola, Fanta, Sprite, Pepsi, Mirinda,
 *   Schweppes, Vegeta, Ehrmann protein pudding, Nutella, Lay's, Kellogg's):
 *   https://world.openfoodfacts.org
 * - Romanian label databases for local foods (telemea, plăcintă, zacuscă): https://eatntrack.ro,
 *   https://klorii.ro
 * - Brand labels: Monin syrups, Optimum Nutrition (whey, Serious Mass), Arla skyr, Oatly, Alpro,
 *   Barilla, Kikkoman, Baileys, Red Bull.
 */
export interface Nutrients {
  kcal: number;
  protein: number; // g
  fat: number; // g
  carbs: number; // g
  sugar?: number; // g
  fiber?: number; // g
  salt?: number; // g
}

export interface NutritionEntry {
  /** What the numbers are for: 100 g, 100 ml, or one piece. */
  per: '100g' | '100ml' | 'piece';
  base: Nutrients;
  /** Kinds that differ from the base (keys exactly as the catalog's kind names). */
  kinds?: Record<string, Nutrients>;
}

/** Spirits at 40 % ABV: 31.6 g alcohol per 100 ml. */
const SPIRIT_40: Nutrients = { kcal: 222, protein: 0, fat: 0, carbs: 0, sugar: 0 };
const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0 };
const WATER: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0.01 };

export const NUTRITION: Record<string, NutritionEntry> = {
  // ── Produce (raw) ─────────────────────────────────────────────────────────────────────────
  Tomatoes: {
    per: '100g',
    base: { kcal: 18, protein: 0.9, fat: 0.2, carbs: 2.7, sugar: 2.6, fiber: 1.2 },
  },
  'Cherry tomatoes': {
    per: '100g',
    base: { kcal: 18, protein: 0.9, fat: 0.2, carbs: 2.7, sugar: 2.6, fiber: 1.2 },
  },
  Cucumbers: {
    per: '100g',
    base: { kcal: 16, protein: 0.7, fat: 0.1, carbs: 3.1, sugar: 1.7, fiber: 0.5 },
  },
  Carrots: {
    per: '100g',
    base: { kcal: 41, protein: 0.9, fat: 0.2, carbs: 6.8, sugar: 4.7, fiber: 2.8, salt: 0.17 },
  },
  Potatoes: {
    per: '100g',
    base: { kcal: 77, protein: 2.0, fat: 0.1, carbs: 15.4, sugar: 0.8, fiber: 2.2 },
  },
  Onions: {
    per: '100g',
    base: { kcal: 40, protein: 1.1, fat: 0.1, carbs: 7.6, sugar: 4.2, fiber: 1.7 },
  },
  'Red onions': {
    per: '100g',
    base: { kcal: 40, protein: 1.1, fat: 0.1, carbs: 7.6, sugar: 4.2, fiber: 1.7 },
  },
  Garlic: {
    per: '100g',
    base: { kcal: 149, protein: 6.4, fat: 0.5, carbs: 31.0, sugar: 1.0, fiber: 2.1 },
  },
  'Bell peppers': {
    per: '100g',
    base: { kcal: 31, protein: 1.0, fat: 0.3, carbs: 4.6, sugar: 4.2, fiber: 1.9 },
  },
  'Chili peppers': {
    per: '100g',
    base: { kcal: 40, protein: 1.9, fat: 0.4, carbs: 7.3, sugar: 5.3, fiber: 1.5 },
  },
  Lettuce: {
    per: '100g',
    base: { kcal: 15, protein: 1.4, fat: 0.2, carbs: 1.6, sugar: 0.8, fiber: 1.3 },
  },
  Cabbage: {
    per: '100g',
    base: { kcal: 25, protein: 1.3, fat: 0.1, carbs: 3.3, sugar: 3.2, fiber: 2.5 },
  },
  Broccoli: {
    per: '100g',
    base: { kcal: 34, protein: 2.8, fat: 0.4, carbs: 4.0, sugar: 1.7, fiber: 2.6 },
  },
  Mushrooms: {
    per: '100g',
    base: { kcal: 22, protein: 3.1, fat: 0.3, carbs: 1.5, sugar: 1.0, fiber: 1.0 },
  },
  Eggplants: {
    per: '100g',
    base: { kcal: 24, protein: 1.0, fat: 0.2, carbs: 3.0, sugar: 2.9, fiber: 3.0 },
  },
  Zucchini: {
    per: '100g',
    base: { kcal: 17, protein: 1.2, fat: 0.3, carbs: 2.1, sugar: 1.7, fiber: 1.0 },
  },
  Corn: {
    per: '100g',
    base: { kcal: 86, protein: 3.3, fat: 1.4, carbs: 16.7, sugar: 6.3, fiber: 2.0 },
  },
  Avocados: {
    per: '100g',
    base: { kcal: 160, protein: 2.0, fat: 14.7, carbs: 1.9, sugar: 0.7, fiber: 6.7 },
  },
  // Citrus: USDA's carbs include ~5 g citric acid (3 kcal/g); carbs here hold sugars and a share of it.
  Lemons: {
    per: '100g',
    base: { kcal: 29, protein: 1.1, fat: 0.3, carbs: 4.5, sugar: 2.5, fiber: 2.8 },
  },
  Limes: {
    per: '100g',
    base: { kcal: 30, protein: 0.7, fat: 0.2, carbs: 5.0, sugar: 1.7, fiber: 2.8 },
  },
  Apples: {
    per: '100g',
    base: { kcal: 52, protein: 0.3, fat: 0.2, carbs: 11.4, sugar: 10.4, fiber: 2.4 },
  },
  Bananas: {
    per: '100g',
    base: { kcal: 89, protein: 1.1, fat: 0.3, carbs: 20.2, sugar: 12.2, fiber: 2.6 },
  },
  Oranges: {
    per: '100g',
    base: { kcal: 47, protein: 0.9, fat: 0.1, carbs: 9.4, sugar: 9.4, fiber: 2.4 },
  },
  Strawberries: {
    per: '100g',
    base: { kcal: 32, protein: 0.7, fat: 0.3, carbs: 5.7, sugar: 4.9, fiber: 2.0 },
  },
  Grapes: {
    per: '100g',
    base: { kcal: 69, protein: 0.7, fat: 0.2, carbs: 17.2, sugar: 15.5, fiber: 0.9 },
  },
  Pears: {
    per: '100g',
    base: { kcal: 57, protein: 0.4, fat: 0.1, carbs: 12.1, sugar: 9.8, fiber: 3.1 },
  },
  Watermelon: {
    per: '100g',
    base: { kcal: 30, protein: 0.6, fat: 0.2, carbs: 7.2, sugar: 6.2, fiber: 0.4 },
  },
  Cherries: {
    per: '100g',
    base: { kcal: 63, protein: 1.1, fat: 0.2, carbs: 14.0, sugar: 12.8, fiber: 2.1 },
  },
  Dill: { per: '100g', base: { kcal: 43, protein: 3.5, fat: 1.1, carbs: 4.9, fiber: 2.1 } },
  Parsley: {
    per: '100g',
    base: { kcal: 36, protein: 3.0, fat: 0.8, carbs: 3.0, sugar: 0.9, fiber: 3.3 },
  },
  Basil: {
    per: '100g',
    base: { kcal: 23, protein: 3.2, fat: 0.6, carbs: 1.1, sugar: 0.3, fiber: 1.6 },
  },
  Spinach: {
    per: '100g',
    base: { kcal: 23, protein: 2.9, fat: 0.4, carbs: 1.4, sugar: 0.4, fiber: 2.2, salt: 0.2 },
  },
  Beetroot: {
    per: '100g',
    base: { kcal: 43, protein: 1.6, fat: 0.2, carbs: 7.0, sugar: 6.8, fiber: 2.8, salt: 0.2 },
  },
  Radishes: {
    per: '100g',
    base: { kcal: 16, protein: 0.7, fat: 0.1, carbs: 2.0, sugar: 1.9, fiber: 1.6 },
  },
  'Green onions': {
    per: '100g',
    base: { kcal: 32, protein: 1.8, fat: 0.2, carbs: 4.7, sugar: 2.3, fiber: 2.6 },
  },
  Leek: {
    per: '100g',
    base: { kcal: 61, protein: 1.5, fat: 0.3, carbs: 12.4, sugar: 3.9, fiber: 1.8 },
  },
  Celery: {
    per: '100g',
    base: { kcal: 14, protein: 0.7, fat: 0.2, carbs: 1.4, sugar: 1.3, fiber: 1.6, salt: 0.2 },
  },
  Cilantro: {
    per: '100g',
    base: { kcal: 23, protein: 2.1, fat: 0.5, carbs: 0.9, sugar: 0.9, fiber: 2.8 },
  },
  Mint: { per: '100g', base: { kcal: 70, protein: 3.8, fat: 0.9, carbs: 6.9, fiber: 8.0 } },
  'Passion fruit': {
    per: '100g',
    base: { kcal: 97, protein: 2.2, fat: 0.7, carbs: 13.0, sugar: 11.2, fiber: 10.4 },
  },
  'Ginger root': {
    per: '100g',
    base: { kcal: 80, protein: 1.8, fat: 0.8, carbs: 15.8, sugar: 1.7, fiber: 2.0 },
  },
  Pumpkin: {
    per: '100g',
    base: { kcal: 26, protein: 1.0, fat: 0.1, carbs: 5.5, sugar: 2.8, fiber: 0.5 },
  },
  'Sweet potatoes': {
    per: '100g',
    base: { kcal: 86, protein: 1.6, fat: 0.1, carbs: 17.1, sugar: 4.2, fiber: 3.0 },
  },
  Plums: {
    per: '100g',
    base: { kcal: 46, protein: 0.7, fat: 0.3, carbs: 10.0, sugar: 9.9, fiber: 1.4 },
  },
  Peaches: {
    per: '100g',
    base: { kcal: 39, protein: 0.9, fat: 0.3, carbs: 8.4, sugar: 8.4, fiber: 1.5 },
  },
  Apricots: {
    per: '100g',
    base: { kcal: 48, protein: 1.4, fat: 0.4, carbs: 9.2, sugar: 9.2, fiber: 2.0 },
  },
  Kiwi: {
    per: '100g',
    base: { kcal: 61, protein: 1.1, fat: 0.5, carbs: 11.7, sugar: 9.0, fiber: 3.0 },
  },
  Pomegranate: {
    per: '100g',
    base: { kcal: 83, protein: 1.7, fat: 1.2, carbs: 14.7, sugar: 13.7, fiber: 4.0 },
  },
  Blueberries: {
    per: '100g',
    base: { kcal: 57, protein: 0.7, fat: 0.3, carbs: 12.1, sugar: 10.0, fiber: 2.4 },
  },
  Raspberries: {
    per: '100g',
    base: { kcal: 52, protein: 1.2, fat: 0.7, carbs: 5.4, sugar: 4.4, fiber: 6.5 },
  },

  // ── Bakery ────────────────────────────────────────────────────────────────────────────────
  Bread: {
    per: '100g',
    base: { kcal: 255, protein: 8.5, fat: 2.0, carbs: 49.0, sugar: 3.0, fiber: 2.8, salt: 1.2 }, // white
    kinds: {
      Brown: { kcal: 245, protein: 9.0, fat: 2.5, carbs: 43.0, sugar: 3.5, fiber: 5.0, salt: 1.1 },
      Rye: { kcal: 230, protein: 7.5, fat: 1.5, carbs: 44.0, sugar: 3.5, fiber: 6.0, salt: 1.3 },
      'Whole grain': {
        kcal: 240,
        protein: 10.0,
        fat: 3.0,
        carbs: 39.0,
        sugar: 3.0,
        fiber: 7.0,
        salt: 1.1,
      },
      Seeded: {
        kcal: 275,
        protein: 11.0,
        fat: 8.0,
        carbs: 36.0,
        sugar: 3.0,
        fiber: 7.0,
        salt: 1.1,
      },
      Toast: { kcal: 265, protein: 8.0, fat: 3.5, carbs: 48.0, sugar: 4.5, fiber: 3.0, salt: 1.2 },
      Black: { kcal: 210, protein: 6.5, fat: 1.5, carbs: 40.0, sugar: 7.0, fiber: 6.0, salt: 1.2 },
      Bran: { kcal: 230, protein: 9.0, fat: 3.0, carbs: 38.0, sugar: 3.0, fiber: 9.0, salt: 1.1 },
    },
  },
  Baguette: {
    per: '100g',
    base: { kcal: 270, protein: 9.0, fat: 1.5, carbs: 54.0, sugar: 2.5, fiber: 2.5, salt: 1.4 },
  },
  Croissants: {
    per: '100g',
    base: { kcal: 406, protein: 8.2, fat: 21.0, carbs: 43.0, sugar: 11.3, fiber: 2.6, salt: 1.0 },
  },
  Tortillas: {
    per: '100g',
    base: { kcal: 310, protein: 8.5, fat: 7.5, carbs: 50.0, sugar: 2.5, fiber: 3.0, salt: 1.3 },
  },
  Plăcintă: {
    per: '100g',
    base: { kcal: 290, protein: 8.0, fat: 15.0, carbs: 30.0, sugar: 3.0, fiber: 1.2, salt: 1.0 }, // cheese
    kinds: {
      Potato: {
        kcal: 240,
        protein: 5.0,
        fat: 11.0,
        carbs: 30.0,
        sugar: 1.0,
        fiber: 1.8,
        salt: 0.9,
      },
      Cabbage: {
        kcal: 220,
        protein: 4.5,
        fat: 10.0,
        carbs: 27.0,
        sugar: 3.0,
        fiber: 2.5,
        salt: 0.9,
      },
      Pumpkin: {
        kcal: 230,
        protein: 4.0,
        fat: 9.5,
        carbs: 32.0,
        sugar: 10.0,
        fiber: 2.0,
        salt: 0.5,
      },
      Cherry: {
        kcal: 260,
        protein: 4.0,
        fat: 10.0,
        carbs: 38.0,
        sugar: 15.0,
        fiber: 1.5,
        salt: 0.3,
      },
    },
  },

  // ── Meat (raw) ────────────────────────────────────────────────────────────────────────────
  'Beef steak': {
    per: '100g',
    base: { kcal: 190, protein: 20.0, fat: 12.0, carbs: 0, salt: 0.15 }, // sirloin
    kinds: {
      Ribeye: { kcal: 270, protein: 18.0, fat: 22.0, carbs: 0, salt: 0.15 },
      Tenderloin: { kcal: 160, protein: 21.0, fat: 8.5, carbs: 0, salt: 0.15 },
      'T-bone': { kcal: 220, protein: 19.0, fat: 16.0, carbs: 0, salt: 0.15 },
    },
  },
  Pork: { per: '100g', base: { kcal: 200, protein: 19.0, fat: 14.0, carbs: 0, salt: 0.15 } },
  'Chicken breast': {
    per: '100g',
    base: { kcal: 120, protein: 22.5, fat: 2.6, carbs: 0, salt: 0.2 },
  },
  'Chicken thighs': {
    per: '100g',
    base: { kcal: 210, protein: 17.0, fat: 15.5, carbs: 0, salt: 0.2 },
  },
  'Whole chicken': {
    per: '100g',
    base: { kcal: 215, protein: 18.6, fat: 15.1, carbs: 0, salt: 0.2 },
  },
  'Chicken wings': {
    per: '100g',
    base: { kcal: 222, protein: 18.3, fat: 16.0, carbs: 0, salt: 0.2 },
  },
  'Chicken liver': {
    per: '100g',
    base: { kcal: 119, protein: 16.9, fat: 4.8, carbs: 0.7, salt: 0.2 },
  },
  Turkey: { per: '100g', base: { kcal: 114, protein: 23.7, fat: 1.5, carbs: 0.1, salt: 0.15 } },
  Lamb: { per: '100g', base: { kcal: 282, protein: 16.6, fat: 23.4, carbs: 0, salt: 0.15 } },
  'Minced meat': {
    per: '100g',
    base: { kcal: 260, protein: 17.0, fat: 21.0, carbs: 0, salt: 0.2 }, // mixed pork and beef
    kinds: {
      Beef: { kcal: 215, protein: 18.5, fat: 15.5, carbs: 0, salt: 0.2 },
      Chicken: { kcal: 143, protein: 17.4, fat: 8.1, carbs: 0, salt: 0.2 },
    },
  },
  Sausages: {
    per: '100g',
    base: { kcal: 255, protein: 12.0, fat: 22.0, carbs: 2.0, sugar: 0.5, salt: 2.2 }, // boiled
    kinds: {
      Smoked: { kcal: 420, protein: 16.0, fat: 38.0, carbs: 2.0, sugar: 0.5, salt: 3.5 },
      'Hot dogs': { kcal: 270, protein: 11.0, fat: 24.0, carbs: 3.0, sugar: 1.0, salt: 2.2 },
    },
  },
  Bacon: {
    per: '100g',
    base: { kcal: 417, protein: 12.6, fat: 40.0, carbs: 1.3, sugar: 0.5, salt: 2.5 },
  },
  Ham: {
    per: '100g',
    base: { kcal: 120, protein: 18.0, fat: 4.0, carbs: 1.5, sugar: 1.0, salt: 2.3 },
  },
  Salami: {
    per: '100g',
    base: { kcal: 380, protein: 22.0, fat: 32.0, carbs: 1.5, sugar: 0.5, salt: 4.5 },
  },
  'Smoked meat': {
    per: '100g',
    base: { kcal: 250, protein: 20.0, fat: 18.0, carbs: 1.0, sugar: 0.5, salt: 3.5 },
  },
  'Canned meat': {
    per: '100g',
    base: { kcal: 220, protein: 15.0, fat: 17.5, carbs: 0.5, salt: 1.5 }, // beef
    kinds: {
      Pork: { kcal: 330, protein: 14.0, fat: 30.0, carbs: 0.5, salt: 1.5 },
      Chicken: { kcal: 190, protein: 17.0, fat: 13.5, carbs: 0.5, salt: 1.5 },
    },
  },
  'Liver pâté': {
    per: '100g',
    base: { kcal: 300, protein: 12.0, fat: 27.0, carbs: 3.0, sugar: 0.5, salt: 1.8 },
  },

  // ── Fish ──────────────────────────────────────────────────────────────────────────────────
  Salmon: { per: '100g', base: { kcal: 208, protein: 20.4, fat: 13.4, carbs: 0, salt: 0.15 } },
  'Fish fillet': { per: '100g', base: { kcal: 80, protein: 17.5, fat: 1.0, carbs: 0, salt: 0.2 } }, // hake, pollock
  Shrimp: { per: '100g', base: { kcal: 85, protein: 20.1, fat: 0.5, carbs: 0, salt: 0.6 } },
  'Tuna (canned)': {
    per: '100g',
    base: { kcal: 198, protein: 29.1, fat: 8.2, carbs: 0, salt: 0.9 }, // in oil, drained
    kinds: {
      'In water': { kcal: 116, protein: 25.5, fat: 0.8, carbs: 0, salt: 0.8 },
      Salad: { kcal: 150, protein: 9.0, fat: 8.0, carbs: 10.0, sugar: 3.0, fiber: 2.5, salt: 1.2 },
    },
  },
  Herring: { per: '100g', base: { kcal: 220, protein: 18.0, fat: 16.0, carbs: 0, salt: 5.0 } }, // salted
  'Canned sardines': {
    per: '100g',
    base: { kcal: 208, protein: 24.6, fat: 11.5, carbs: 0, salt: 1.2 },
  },
  'Crab sticks': {
    per: '100g',
    base: { kcal: 95, protein: 6.0, fat: 1.0, carbs: 15.0, sugar: 3.0, salt: 1.6 },
  },
  'Canned salmon': {
    per: '100g',
    base: { kcal: 140, protein: 21.0, fat: 6.0, carbs: 0, salt: 0.9 },
  },
  'Mackerel (canned)': {
    per: '100g',
    base: { kcal: 220, protein: 18.0, fat: 16.5, carbs: 0, salt: 1.0 },
  },
  Sprats: { per: '100g', base: { kcal: 360, protein: 17.5, fat: 32.0, carbs: 0, salt: 1.5 } }, // in oil

  // ── Dairy and eggs ────────────────────────────────────────────────────────────────────────
  Milk: {
    per: '100ml',
    base: { kcal: 53, protein: 3.0, fat: 2.5, carbs: 4.7, sugar: 4.7, salt: 0.1 }, // 2.5 %
    kinds: {
      '1.5%': { kcal: 44, protein: 3.0, fat: 1.5, carbs: 4.7, sugar: 4.7, salt: 0.1 },
      '3.2%': { kcal: 60, protein: 2.9, fat: 3.2, carbs: 4.7, sugar: 4.7, salt: 0.1 },
      '3.5%': { kcal: 64, protein: 3.3, fat: 3.5, carbs: 4.8, sugar: 4.8, salt: 0.1 },
      Barista: { kcal: 64, protein: 3.3, fat: 3.5, carbs: 4.8, sugar: 4.8, salt: 0.1 },
      'Lactose-free': { kcal: 45, protein: 3.4, fat: 1.5, carbs: 4.7, sugar: 4.7, salt: 0.1 },
      Oat: { kcal: 46, protein: 1.0, fat: 1.5, carbs: 6.7, sugar: 4.0, fiber: 0.8, salt: 0.1 },
      Almond: { kcal: 24, protein: 0.5, fat: 1.1, carbs: 3.0, sugar: 3.0, fiber: 0.4, salt: 0.13 },
    },
  },
  'Oat milk': {
    per: '100ml',
    base: { kcal: 46, protein: 1.0, fat: 1.5, carbs: 6.7, sugar: 4.0, fiber: 0.8, salt: 0.1 },
  },
  Kefir: {
    per: '100ml',
    base: { kcal: 50, protein: 2.9, fat: 2.5, carbs: 4.0, sugar: 4.0, salt: 0.1 },
  }, // 2.5 %
  Eggs: {
    per: '100g',
    base: { kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7, sugar: 0.4, salt: 0.36 },
  },
  Cheese: {
    per: '100g',
    base: { kcal: 356, protein: 25.0, fat: 27.4, carbs: 2.2, sugar: 0, salt: 2.0 }, // Gouda; Edam, Maasdam alike
    kinds: {
      Cheddar: { kcal: 403, protein: 24.9, fat: 33.1, carbs: 1.3, sugar: 0.5, salt: 1.7 },
      Processed: { kcal: 290, protein: 15.0, fat: 24.0, carbs: 3.5, sugar: 3.5, salt: 2.5 },
      Smoked: { kcal: 300, protein: 23.0, fat: 23.0, carbs: 0, sugar: 0, salt: 2.5 },
    },
  },
  Feta: {
    per: '100g',
    base: { kcal: 264, protein: 14.2, fat: 21.3, carbs: 4.1, sugar: 4.1, salt: 2.8 },
  },
  Mozzarella: {
    per: '100g',
    base: { kcal: 250, protein: 18.0, fat: 19.0, carbs: 1.0, sugar: 1.0, salt: 0.5 },
  }, // fresh
  Parmesan: {
    per: '100g',
    base: { kcal: 392, protein: 35.8, fat: 25.8, carbs: 3.2, sugar: 0.8, salt: 4.0 },
  },
  'Cream cheese': {
    per: '100g',
    base: { kcal: 225, protein: 5.5, fat: 21.0, carbs: 3.5, sugar: 3.5, salt: 0.75 },
  },
  Mascarpone: {
    per: '100g',
    base: { kcal: 429, protein: 4.6, fat: 44.0, carbs: 3.6, sugar: 3.6, salt: 0.1 },
  },
  Telemea: {
    per: '100g',
    base: { kcal: 273, protein: 18.5, fat: 21.0, carbs: 1.0, sugar: 1.0, salt: 2.8 },
  }, // cow
  'Cottage cheese': {
    per: '100g',
    base: { kcal: 121, protein: 16.0, fat: 5.0, carbs: 3.0, sugar: 3.0, salt: 0.1 },
  }, // 5 %
  Butter: {
    per: '100g',
    base: { kcal: 740, protein: 0.7, fat: 82.0, carbs: 0.6, sugar: 0.6, salt: 0.02 },
  },
  Yogurt: {
    per: '100g',
    base: { kcal: 62, protein: 3.5, fat: 3.2, carbs: 4.7, sugar: 4.7, salt: 0.12 }, // plain
    kinds: {
      Greek: { kcal: 128, protein: 5.0, fat: 10.0, carbs: 4.0, sugar: 4.0, salt: 0.1 },
      Fruit: { kcal: 95, protein: 3.0, fat: 2.5, carbs: 15.0, sugar: 14.0, salt: 0.1 },
    },
  },
  'Sour cream': {
    per: '100g',
    base: { kcal: 204, protein: 2.5, fat: 20.0, carbs: 3.4, sugar: 3.4, salt: 0.1 },
  }, // 20 %
  Cream: {
    per: '100ml',
    base: { kcal: 118, protein: 3.0, fat: 10.0, carbs: 4.0, sugar: 4.0, salt: 0.1 }, // 10 %
    kinds: {
      '20%': { kcal: 206, protein: 2.8, fat: 20.0, carbs: 3.7, sugar: 3.7, salt: 0.1 },
      '33% (for whipping)': {
        kcal: 318,
        protein: 2.2,
        fat: 33.0,
        carbs: 3.0,
        sugar: 3.0,
        salt: 0.1,
      },
    },
  },
  'Whipped cream': {
    per: '100g',
    base: { kcal: 257, protein: 3.2, fat: 22.2, carbs: 12.5, sugar: 8.0, salt: 0.3 },
  },
  Skyr: {
    per: '100g',
    base: { kcal: 63, protein: 11.0, fat: 0.2, carbs: 4.0, sugar: 4.0, salt: 0.1 },
  },
  'Protein pudding': {
    per: '100g',
    base: { kcal: 79, protein: 10.0, fat: 1.9, carbs: 5.6, sugar: 4.0, fiber: 0.5, salt: 0.3 },
  },

  // ── Frozen ────────────────────────────────────────────────────────────────────────────────
  'Frozen vegetables': {
    per: '100g',
    base: { kcal: 65, protein: 3.3, fat: 0.5, carbs: 9.5, sugar: 3.2, fiber: 4.0, salt: 0.1 },
  },
  'Mexican mix': {
    per: '100g',
    base: { kcal: 70, protein: 3.5, fat: 0.6, carbs: 11.0, sugar: 3.5, fiber: 3.5, salt: 0.1 },
  },
  'Frozen spinach': {
    per: '100g',
    base: { kcal: 25, protein: 3.0, fat: 0.5, carbs: 1.0, sugar: 0.5, fiber: 2.5, salt: 0.2 },
  },
  'Frozen berries': {
    per: '100g',
    base: { kcal: 45, protein: 1.0, fat: 0.4, carbs: 7.5, sugar: 6.5, fiber: 4.5 },
  },
  'Ice cream': {
    per: '100g',
    base: { kcal: 227, protein: 3.5, fat: 13.0, carbs: 24.0, sugar: 21.0, salt: 0.1 },
  }, // plombir
  Dumplings: {
    per: '100g',
    base: { kcal: 250, protein: 11.0, fat: 12.0, carbs: 25.0, sugar: 1.0, fiber: 1.5, salt: 1.2 },
  }, // pelmeni
  'Fish sticks': {
    per: '100g',
    base: { kcal: 220, protein: 12.0, fat: 10.0, carbs: 20.0, sugar: 1.5, fiber: 1.0, salt: 0.8 },
  },
  'French fries': {
    per: '100g',
    base: { kcal: 150, protein: 2.2, fat: 5.0, carbs: 23.0, sugar: 0.5, fiber: 2.5, salt: 0.3 },
  },
  'Frozen pizza': {
    per: '100g',
    base: { kcal: 245, protein: 10.0, fat: 9.0, carbs: 30.0, sugar: 4.0, fiber: 2.0, salt: 1.2 },
  },
  'Ice cubes': { per: '100g', base: ZERO },

  // ── Pantry: grains, flour, legumes (dry) ──────────────────────────────────────────────────
  Rice: {
    per: '100g',
    // white: long grain, round, basmati, jasmine, sushi, parboiled, arborio are within a few %
    base: { kcal: 355, protein: 7.1, fat: 0.7, carbs: 79.0, sugar: 0.1, fiber: 1.3 },
    kinds: {
      Brown: { kcal: 367, protein: 7.5, fat: 3.2, carbs: 72.7, sugar: 0.9, fiber: 3.6 },
      Wild: { kcal: 357, protein: 14.7, fat: 1.1, carbs: 68.7, sugar: 2.5, fiber: 6.2 },
      Black: { kcal: 356, protein: 9.0, fat: 3.0, carbs: 70.0, sugar: 1.0, fiber: 4.5 },
    },
  },
  Pasta: {
    per: '100g',
    // dry durum wheat; cannelloni tubes and orzo are sold dry and unfilled
    base: { kcal: 359, protein: 13.0, fat: 2.0, carbs: 71.0, sugar: 3.0, fiber: 3.0, salt: 0.01 },
    kinds: {
      Ravioli: {
        kcal: 250,
        protein: 9.5,
        fat: 9.0,
        carbs: 32.0,
        sugar: 2.0,
        fiber: 2.5,
        salt: 1.0,
      }, // fresh, filled
      Lasagne: {
        kcal: 365,
        protein: 14.0,
        fat: 4.0,
        carbs: 67.0,
        sugar: 2.0,
        fiber: 3.0,
        salt: 0.1,
      }, // egg sheets
      Tagliatelle: {
        kcal: 365,
        protein: 14.0,
        fat: 4.0,
        carbs: 67.0,
        sugar: 2.0,
        fiber: 3.0,
        salt: 0.1,
      }, // egg
      'Whole wheat': {
        kcal: 348,
        protein: 13.0,
        fat: 2.5,
        carbs: 64.0,
        sugar: 3.0,
        fiber: 8.0,
        salt: 0.01,
      },
      'Gluten-free': {
        kcal: 357,
        protein: 7.0,
        fat: 1.5,
        carbs: 78.0,
        sugar: 0.5,
        fiber: 2.5,
        salt: 0.01,
      },
    },
  },
  Flour: {
    per: '100g',
    base: { kcal: 340, protein: 10.0, fat: 1.2, carbs: 71.0, sugar: 0.5, fiber: 3.0 },
  },
  Oats: {
    per: '100g',
    base: { kcal: 372, protein: 13.5, fat: 7.0, carbs: 58.7, sugar: 1.0, fiber: 10.0 },
  },
  Buckwheat: {
    per: '100g',
    base: { kcal: 346, protein: 11.7, fat: 2.7, carbs: 64.6, sugar: 0.6, fiber: 10.3 },
  },
  Lentils: {
    per: '100g',
    base: { kcal: 345, protein: 24.6, fat: 1.1, carbs: 52.7, sugar: 2.0, fiber: 10.7 },
  },
  'Corn grits': {
    per: '100g',
    base: { kcal: 365, protein: 8.5, fat: 1.5, carbs: 77.0, sugar: 0.6, fiber: 4.0 },
  },
  Bulgur: {
    per: '100g',
    base: { kcal: 342, protein: 12.3, fat: 1.3, carbs: 63.4, sugar: 0.4, fiber: 12.5 },
  },
  Couscous: {
    per: '100g',
    base: { kcal: 360, protein: 12.8, fat: 0.6, carbs: 72.4, sugar: 0.5, fiber: 5.0 },
  },
  Quinoa: {
    per: '100g',
    base: { kcal: 368, protein: 14.1, fat: 6.1, carbs: 57.2, sugar: 1.5, fiber: 7.0 },
  },
  Semolina: {
    per: '100g',
    base: { kcal: 360, protein: 12.7, fat: 1.1, carbs: 68.9, sugar: 0.5, fiber: 3.9 },
  },
  Breadcrumbs: {
    per: '100g',
    base: { kcal: 380, protein: 13.4, fat: 5.3, carbs: 67.5, sugar: 6.2, fiber: 4.5, salt: 1.8 },
  },
  'Corn starch': {
    per: '100g',
    base: { kcal: 381, protein: 0.3, fat: 0.1, carbs: 91.3, sugar: 0, fiber: 0.9 },
  },
  'Breakfast cereal': {
    per: '100g',
    base: { kcal: 378, protein: 7.0, fat: 0.9, carbs: 84.0, sugar: 8.0, fiber: 3.0, salt: 1.1 },
  }, // corn flakes
  Muesli: {
    per: '100g',
    base: { kcal: 365, protein: 10.0, fat: 6.5, carbs: 62.0, sugar: 15.0, fiber: 8.0, salt: 0.1 },
  },

  // ── Pantry: cans and jars (canned vegetables and legumes drained) ─────────────────────────
  'Canned beans': {
    per: '100g',
    base: { kcal: 95, protein: 6.5, fat: 0.5, carbs: 12.5, sugar: 0.5, fiber: 6.0, salt: 0.6 }, // white, red, mixed alike
  },
  'Canned red beans': {
    per: '100g',
    base: { kcal: 100, protein: 7.0, fat: 0.5, carbs: 13.5, sugar: 0.5, fiber: 6.0, salt: 0.6 },
  },
  'Canned chickpeas': {
    per: '100g',
    base: { kcal: 120, protein: 7.0, fat: 2.5, carbs: 14.0, sugar: 0.5, fiber: 5.5, salt: 0.6 },
  },
  'Canned lentils': {
    per: '100g',
    base: { kcal: 90, protein: 6.5, fat: 0.4, carbs: 12.5, sugar: 0.6, fiber: 4.0, salt: 0.5 },
  },
  'Beans in tomato sauce': {
    per: '100g',
    base: { kcal: 78, protein: 4.7, fat: 0.2, carbs: 12.9, sugar: 4.6, fiber: 3.8, salt: 0.6 },
  },
  'Canned corn': {
    per: '100g',
    base: { kcal: 80, protein: 2.8, fat: 1.2, carbs: 13.0, sugar: 5.0, fiber: 2.5, salt: 0.6 }, // sweet
    kinds: {
      'Baby corn': {
        kcal: 26,
        protein: 1.9,
        fat: 0.2,
        carbs: 3.5,
        sugar: 1.5,
        fiber: 1.7,
        salt: 0.7,
      },
    },
  },
  'Canned peas': {
    per: '100g',
    base: { kcal: 70, protein: 5.0, fat: 0.4, carbs: 9.0, sugar: 3.5, fiber: 5.0, salt: 0.6 },
  },
  'Canned mushrooms': {
    per: '100g',
    base: { kcal: 22, protein: 2.0, fat: 0.3, carbs: 2.0, sugar: 0.5, fiber: 2.0, salt: 0.8 },
  },
  'Canned tomatoes': {
    per: '100g',
    base: { kcal: 22, protein: 1.1, fat: 0.2, carbs: 3.5, sugar: 3.2, fiber: 1.0, salt: 0.1 },
  },
  'Chopped tomatoes': {
    per: '100g',
    base: { kcal: 22, protein: 1.1, fat: 0.2, carbs: 3.5, sugar: 3.2, fiber: 1.0, salt: 0.1 }, // all kinds alike
  },
  'Tomato sauce (canned)': {
    per: '100g',
    base: { kcal: 35, protein: 1.5, fat: 0.5, carbs: 5.5, sugar: 4.5, fiber: 1.3, salt: 0.6 },
  },
  'Tomato paste': {
    per: '100g',
    base: { kcal: 82, protein: 4.3, fat: 0.5, carbs: 14.8, sugar: 12.2, fiber: 4.1, salt: 0.15 },
  },
  'Canned pineapple': {
    per: '100g',
    base: { kcal: 60, protein: 0.4, fat: 0.1, carbs: 14.0, sugar: 13.0, fiber: 0.8 },
  }, // in juice
  'Canned peaches': {
    per: '100g',
    base: { kcal: 65, protein: 0.5, fat: 0.1, carbs: 15.0, sugar: 14.0, fiber: 1.0 },
  }, // light syrup
  'Coconut milk': {
    per: '100ml',
    base: { kcal: 180, protein: 1.5, fat: 18.0, carbs: 3.0, sugar: 2.0, fiber: 0.5, salt: 0.05 },
  },
  Olives: {
    per: '100g',
    base: { kcal: 145, protein: 1.0, fat: 15.3, carbs: 0.5, sugar: 0, fiber: 3.3, salt: 3.9 },
  },
  Pickles: {
    per: '100g',
    base: { kcal: 20, protein: 0.6, fat: 0.1, carbs: 3.5, sugar: 2.5, fiber: 1.0, salt: 2.0 },
  },
  'Pickled tomatoes': {
    per: '100g',
    base: { kcal: 20, protein: 1.0, fat: 0.2, carbs: 3.0, sugar: 2.5, fiber: 1.0, salt: 2.2 },
  },
  Sauerkraut: {
    per: '100g',
    base: { kcal: 19, protein: 0.9, fat: 0.1, carbs: 1.8, sugar: 1.8, fiber: 2.9, salt: 1.7 },
  },
  Zacuscă: {
    per: '100g',
    base: { kcal: 93, protein: 1.2, fat: 5.0, carbs: 9.1, sugar: 6.0, fiber: 2.5, salt: 1.2 }, // eggplant
    kinds: {
      Pepper: { kcal: 110, protein: 1.5, fat: 7.0, carbs: 9.0, sugar: 6.0, fiber: 2.5, salt: 1.2 },
      Mushroom: {
        kcal: 100,
        protein: 2.0,
        fat: 6.5,
        carbs: 7.0,
        sugar: 4.0,
        fiber: 2.5,
        salt: 1.2,
      },
    },
  },
  'Eggplant caviar': {
    per: '100g',
    base: { kcal: 110, protein: 1.5, fat: 8.0, carbs: 7.0, sugar: 5.0, fiber: 3.0, salt: 1.2 },
  },
  Lecho: {
    per: '100g',
    base: { kcal: 60, protein: 1.2, fat: 2.5, carbs: 7.5, sugar: 6.0, fiber: 1.5, salt: 1.2 },
  },
  Ajvar: {
    per: '100g',
    base: { kcal: 90, protein: 1.5, fat: 5.5, carbs: 7.5, sugar: 6.5, fiber: 2.5, salt: 1.3 },
  },
  'Fruit purée': {
    per: '100g',
    base: { kcal: 70, protein: 0.5, fat: 0.2, carbs: 16.0, sugar: 14.0, fiber: 1.5 }, // mango
    kinds: {
      Maracuya: { kcal: 75, protein: 1.5, fat: 0.4, carbs: 14.0, sugar: 11.0, fiber: 4.0 },
      Strawberry: { kcal: 45, protein: 0.7, fat: 0.3, carbs: 8.5, sugar: 7.5, fiber: 2.0 },
      Raspberry: { kcal: 50, protein: 1.2, fat: 0.6, carbs: 6.5, sugar: 5.5, fiber: 6.0 },
      Peach: { kcal: 55, protein: 0.6, fat: 0.1, carbs: 12.5, sugar: 11.0, fiber: 1.5 },
    },
  },

  // ── Pantry: oils, sweet, spreads, nuts, dried fruit (oils per 100 ml, density 0.92) ───────
  'Sunflower oil': { per: '100ml', base: { kcal: 828, protein: 0, fat: 92.0, carbs: 0 } },
  'Olive oil': { per: '100ml', base: { kcal: 828, protein: 0, fat: 92.0, carbs: 0 } },
  Sugar: { per: '100g', base: { kcal: 400, protein: 0, fat: 0, carbs: 100.0, sugar: 100.0 } },
  'Powdered sugar': {
    per: '100g',
    base: { kcal: 398, protein: 0, fat: 0, carbs: 99.6, sugar: 97.8 },
  },
  'Vanilla sugar': {
    per: '100g',
    base: { kcal: 395, protein: 0, fat: 0, carbs: 99.0, sugar: 98.0 },
  },
  Honey: {
    per: '100g',
    base: { kcal: 320, protein: 0.3, fat: 0, carbs: 80.0, sugar: 80.0, fiber: 0.2 },
  },
  Jam: {
    per: '100g',
    base: { kcal: 250, protein: 0.4, fat: 0.1, carbs: 61.0, sugar: 58.0, fiber: 1.0 },
  },
  'Peanut butter': {
    per: '100g',
    base: { kcal: 600, protein: 24.0, fat: 50.0, carbs: 12.0, sugar: 6.0, fiber: 7.0, salt: 1.0 },
  },
  'Chocolate spread': {
    per: '100g',
    base: { kcal: 539, protein: 6.3, fat: 30.9, carbs: 57.5, sugar: 56.3, fiber: 3.4, salt: 0.1 },
  },
  Walnuts: {
    per: '100g',
    base: { kcal: 654, protein: 15.2, fat: 65.2, carbs: 7.0, sugar: 2.6, fiber: 6.7 },
  },
  Almonds: {
    per: '100g',
    base: { kcal: 579, protein: 21.2, fat: 49.9, carbs: 9.1, sugar: 4.4, fiber: 12.5 },
  },
  'Sunflower seeds': {
    per: '100g',
    base: { kcal: 584, protein: 20.8, fat: 51.5, carbs: 11.4, sugar: 2.6, fiber: 8.6 },
  },
  Raisins: {
    per: '100g',
    base: { kcal: 299, protein: 3.1, fat: 0.5, carbs: 75.5, sugar: 59.2, fiber: 3.7 },
  },
  'Dried apricots': {
    per: '100g',
    base: { kcal: 241, protein: 3.4, fat: 0.5, carbs: 55.4, sugar: 53.4, fiber: 7.3 },
  },
  Prunes: {
    per: '100g',
    base: { kcal: 240, protein: 2.2, fat: 0.4, carbs: 56.9, sugar: 38.1, fiber: 7.1 },
  },

  // ── Pantry: coffee and tea ────────────────────────────────────────────────────────────────
  // Per 100 g of beans or grounds, counted as what ends up in the cup (~1.7 l brewed): the
  // grounds themselves (~330 kcal) are thrown away. Beans, ground and capsules alike.
  Coffee: { per: '100g', base: { kcal: 25, protein: 1.5, fat: 0.5, carbs: 3.5, sugar: 0 } },
  'Instant coffee': {
    per: '100g',
    base: { kcal: 353, protein: 12.2, fat: 0.5, carbs: 75.4, sugar: 0 },
  }, // dissolves whole
  Tea: { per: 'piece', base: { kcal: 2, protein: 0, fat: 0, carbs: 0.5, sugar: 0 } }, // one bag, brewed; all kinds alike

  // ── Spices, herbs, baking ─────────────────────────────────────────────────────────────────
  // Dried spices: USDA macros; energy from the EU factors where USDA's specific factors differ.
  Salt: { per: '100g', base: { kcal: 0, protein: 0, fat: 0, carbs: 0, salt: 100.0 } },
  'Black pepper': {
    per: '100g',
    base: { kcal: 251, protein: 10.4, fat: 3.3, carbs: 38.7, sugar: 0.6, fiber: 25.3 },
  },
  Paprika: {
    per: '100g',
    base: { kcal: 300, protein: 14.1, fat: 12.9, carbs: 19.1, sugar: 10.3, fiber: 34.9 },
  },
  'Smoked paprika': {
    per: '100g',
    base: { kcal: 300, protein: 14.1, fat: 12.9, carbs: 19.1, sugar: 10.3, fiber: 34.9 },
  },
  'Chili flakes': {
    per: '100g',
    base: { kcal: 360, protein: 12.0, fat: 17.3, carbs: 29.4, sugar: 10.3, fiber: 27.2 },
  },
  Oregano: {
    per: '100g',
    base: { kcal: 265, protein: 9.0, fat: 4.3, carbs: 26.4, sugar: 4.1, fiber: 42.5 },
  },
  'Dried basil': {
    per: '100g',
    base: { kcal: 245, protein: 23.0, fat: 4.1, carbs: 10.3, sugar: 1.7, fiber: 37.7 },
  },
  Thyme: {
    per: '100g',
    base: { kcal: 276, protein: 9.1, fat: 7.4, carbs: 26.9, sugar: 1.7, fiber: 37.0 },
  },
  Rosemary: { per: '100g', base: { kcal: 331, protein: 4.9, fat: 15.2, carbs: 21.5, fiber: 42.6 } },
  'Bay leaves': {
    per: '100g',
    base: { kcal: 340, protein: 7.6, fat: 8.4, carbs: 48.7, fiber: 26.3 },
  },
  'Dried dill': {
    per: '100g',
    base: { kcal: 300, protein: 20.0, fat: 4.4, carbs: 42.2, fiber: 13.6, salt: 0.5 },
  },
  'Mixed herbs': {
    per: '100g',
    base: { kcal: 270, protein: 9.0, fat: 5.5, carbs: 25.0, sugar: 3.0, fiber: 40.0 },
  },
  Cumin: {
    per: '100g',
    base: { kcal: 400, protein: 17.8, fat: 22.3, carbs: 33.7, sugar: 2.3, fiber: 10.5, salt: 0.4 },
  },
  'Ground coriander': {
    per: '100g',
    base: { kcal: 330, protein: 12.4, fat: 17.8, carbs: 13.0, fiber: 41.9 },
  },
  Cinnamon: {
    per: '100g',
    base: { kcal: 247, protein: 4.0, fat: 1.2, carbs: 27.5, sugar: 2.2, fiber: 53.1 },
  },
  Turmeric: {
    per: '100g',
    base: { kcal: 312, protein: 9.7, fat: 3.3, carbs: 44.4, sugar: 3.2, fiber: 22.7 },
  },
  'Curry powder': {
    per: '100g',
    base: { kcal: 325, protein: 14.3, fat: 14.0, carbs: 2.8, sugar: 2.8, fiber: 53.2, salt: 0.13 },
  },
  'Garlic powder': {
    per: '100g',
    base: { kcal: 331, protein: 16.6, fat: 0.7, carbs: 63.7, sugar: 2.4, fiber: 9.0 },
  },
  'Onion powder': {
    per: '100g',
    base: { kcal: 341, protein: 10.4, fat: 1.0, carbs: 64.7, sugar: 6.6, fiber: 15.2 },
  },
  'Ground ginger': {
    per: '100g',
    base: { kcal: 335, protein: 9.0, fat: 4.2, carbs: 57.5, sugar: 3.4, fiber: 14.1 },
  },
  Nutmeg: {
    per: '100g',
    base: { kcal: 525, protein: 5.8, fat: 36.3, carbs: 28.5, sugar: 28.5, fiber: 20.8 },
  },
  Cloves: {
    per: '100g',
    base: { kcal: 330, protein: 6.0, fat: 13.0, carbs: 31.6, sugar: 2.4, fiber: 33.9, salt: 0.6 },
  },
  Allspice: { per: '100g', base: { kcal: 340, protein: 6.1, fat: 8.7, carbs: 50.5, fiber: 21.6 } },
  Cardamom: { per: '100g', base: { kcal: 311, protein: 10.8, fat: 6.7, carbs: 40.5, fiber: 28.0 } },
  Vegeta: {
    per: '100g',
    base: { kcal: 137, protein: 9.0, fat: 0.6, carbs: 24.5, sugar: 13.0, salt: 56.9 },
  },
  'Khmeli-suneli': {
    per: '100g',
    base: { kcal: 300, protein: 12.0, fat: 7.0, carbs: 30.0, fiber: 30.0 },
  },
  // Vanilla extract, 34 % alcohol by weight (USDA); vanillin powder is mostly sugar, much the same.
  Vanilla: { per: '100g', base: { kcal: 288, protein: 0.1, fat: 0.1, carbs: 12.7, sugar: 12.7 } },
  'Baking soda': { per: '100g', base: { kcal: 0, protein: 0, fat: 0, carbs: 0, salt: 68.5 } },
  'Baking powder': {
    per: '100g',
    base: { kcal: 100, protein: 0, fat: 0, carbs: 25.0, salt: 26.5 },
  },
  'Dry yeast': {
    per: '100g',
    base: { kcal: 325, protein: 40.4, fat: 7.6, carbs: 14.3, sugar: 0, fiber: 26.9, salt: 0.1 },
  },
  'Cocoa powder': {
    per: '100g',
    base: { kcal: 360, protein: 20.0, fat: 21.0, carbs: 10.0, sugar: 1.0, fiber: 33.0, salt: 0.05 },
  },

  // ── Sauces and condiments (bottled sauces per 100 ml, density folded in) ──────────────────
  Ketchup: {
    per: '100ml',
    base: { kcal: 117, protein: 1.4, fat: 0.1, carbs: 26.7, sugar: 26.2, salt: 2.1 },
  },
  Mayonnaise: {
    per: '100ml',
    base: { kcal: 570, protein: 0.6, fat: 61.6, carbs: 3.2, sugar: 2.5, salt: 1.1 },
  }, // 67 %
  Mustard: {
    per: '100ml',
    base: { kcal: 105, protein: 6.0, fat: 5.5, carbs: 7.0, sugar: 4.0, fiber: 2.0, salt: 3.0 },
  },
  'Soy sauce': {
    per: '100ml',
    base: { kcal: 75, protein: 10.0, fat: 0, carbs: 8.0, sugar: 1.0, salt: 16.9 },
  },
  // Vinegar's energy is its acetic acid (3 kcal/g): 9 % table vinegar, 5 % cider, 6 % balsamic.
  Vinegar: { per: '100ml', base: { kcal: 27, protein: 0, fat: 0, carbs: 0.1, sugar: 0 } },
  'Apple cider vinegar': {
    per: '100ml',
    base: { kcal: 21, protein: 0, fat: 0, carbs: 0.9, sugar: 0.4 },
  },
  'Balsamic vinegar': {
    per: '100ml',
    base: { kcal: 115, protein: 0.5, fat: 0, carbs: 25.0, sugar: 22.0, salt: 0.05 },
  },
  'Hot sauce': {
    per: '100ml',
    base: { kcal: 11, protein: 0.5, fat: 0.4, carbs: 1.5, sugar: 1.0, fiber: 0.3, salt: 6.6 },
  },
  Adjika: {
    per: '100ml',
    base: { kcal: 70, protein: 2.0, fat: 2.5, carbs: 9.0, sugar: 6.0, fiber: 2.5, salt: 3.0 },
  },
  Horseradish: {
    per: '100g',
    base: { kcal: 48, protein: 1.2, fat: 0.7, carbs: 8.0, sugar: 8.0, fiber: 3.3, salt: 1.0 },
  },
  'BBQ sauce': {
    per: '100ml',
    base: { kcal: 187, protein: 0.9, fat: 0.7, carbs: 44.0, sugar: 36.0, salt: 2.2 },
  },
  Pesto: {
    per: '100g',
    base: { kcal: 500, protein: 5.0, fat: 50.0, carbs: 6.0, sugar: 4.5, fiber: 2.0, salt: 2.8 },
  },
  'Tomato sauce': {
    per: '100ml',
    base: { kcal: 95, protein: 1.5, fat: 0.5, carbs: 21.0, sugar: 15.0, salt: 2.0 },
  },

  // ── Snacks and sweets ─────────────────────────────────────────────────────────────────────
  Sprinkles: {
    per: '100g',
    base: { kcal: 400, protein: 0.3, fat: 4.0, carbs: 90.0, sugar: 85.0 }, // colourful
    kinds: {
      Chocolate: { kcal: 470, protein: 5.0, fat: 18.0, carbs: 70.0, sugar: 60.0, fiber: 4.0 },
      'Cinnamon sugar': { kcal: 385, protein: 0.3, fat: 0.3, carbs: 95.0, sugar: 92.0, fiber: 1.5 },
    },
  },
  'Chocolate chips': {
    per: '100g',
    base: { kcal: 490, protein: 4.5, fat: 25.0, carbs: 60.0, sugar: 52.0, fiber: 5.0 },
  },
  Marshmallows: {
    per: '100g',
    base: { kcal: 318, protein: 1.8, fat: 0.2, carbs: 81.3, sugar: 57.6, fiber: 0.1, salt: 0.2 },
  },
  Chocolate: {
    per: '100g',
    base: { kcal: 535, protein: 7.6, fat: 29.7, carbs: 57.8, sugar: 51.5, fiber: 3.4, salt: 0.2 }, // milk
    kinds: {
      Dark: {
        kcal: 566,
        protein: 9.5,
        fat: 41.0,
        carbs: 34.0,
        sugar: 29.0,
        fiber: 11.0,
        salt: 0.03,
      }, // 70 %
      White: {
        kcal: 539,
        protein: 5.9,
        fat: 32.1,
        carbs: 59.0,
        sugar: 59.0,
        fiber: 0.2,
        salt: 0.2,
      },
    },
  },
  Cookies: {
    per: '100g',
    base: { kcal: 480, protein: 6.0, fat: 20.0, carbs: 68.0, sugar: 28.0, fiber: 2.5, salt: 0.6 },
  },
  Chips: {
    per: '100g',
    base: { kcal: 536, protein: 6.6, fat: 34.0, carbs: 50.0, sugar: 0.5, fiber: 4.4, salt: 1.4 },
  },
  Popcorn: {
    per: '100g',
    base: { kcal: 450, protein: 9.0, fat: 22.0, carbs: 52.0, sugar: 1.0, fiber: 10.0, salt: 1.5 },
  },
  Croutons: {
    per: '100g',
    base: { kcal: 410, protein: 11.0, fat: 12.0, carbs: 63.0, sugar: 3.0, fiber: 3.5, salt: 2.5 },
  },
  Crackers: {
    per: '100g',
    base: { kcal: 430, protein: 9.0, fat: 14.0, carbs: 67.0, sugar: 5.0, fiber: 3.0, salt: 2.0 },
  },
  'Rice cakes': {
    per: '100g',
    base: { kcal: 387, protein: 8.0, fat: 2.8, carbs: 80.0, sugar: 0.9, fiber: 4.2, salt: 0.1 },
  },
  'Granola bars': {
    per: '100g',
    base: { kcal: 440, protein: 7.0, fat: 17.0, carbs: 62.0, sugar: 28.0, fiber: 5.0, salt: 0.3 },
  },
  Hummus: {
    per: '100g',
    base: { kcal: 250, protein: 7.0, fat: 20.0, carbs: 10.0, sugar: 0.5, fiber: 5.0, salt: 1.1 },
  },
  Cake: {
    per: '100g',
    base: { kcal: 380, protein: 5.5, fat: 18.0, carbs: 48.0, sugar: 28.0, fiber: 1.0, salt: 0.4 }, // honey cake
    kinds: {
      Napoleon: {
        kcal: 400,
        protein: 5.0,
        fat: 24.0,
        carbs: 40.0,
        sugar: 22.0,
        fiber: 1.0,
        salt: 0.4,
      },
      Chocolate: {
        kcal: 390,
        protein: 5.0,
        fat: 20.0,
        carbs: 47.0,
        sugar: 34.0,
        fiber: 2.5,
        salt: 0.4,
      },
      Cheesecake: {
        kcal: 321,
        protein: 5.5,
        fat: 22.5,
        carbs: 24.0,
        sugar: 20.0,
        fiber: 0.4,
        salt: 0.4,
      },
    },
  },
  Pastries: {
    per: '100g',
    base: { kcal: 380, protein: 5.0, fat: 20.0, carbs: 45.0, sugar: 25.0, fiber: 1.0, salt: 0.3 },
  },

  // ── Meals ─────────────────────────────────────────────────────────────────────────────────
  Pizza: {
    per: '100g',
    base: { kcal: 240, protein: 10.5, fat: 8.5, carbs: 30.0, sugar: 3.0, fiber: 2.0, salt: 1.2 }, // margherita
    kinds: {
      Pepperoni: {
        kcal: 280,
        protein: 12.0,
        fat: 12.5,
        carbs: 29.0,
        sugar: 3.0,
        fiber: 2.0,
        salt: 1.6,
      },
      'Four cheeses': {
        kcal: 285,
        protein: 13.0,
        fat: 13.0,
        carbs: 28.0,
        sugar: 2.5,
        fiber: 1.5,
        salt: 1.5,
      },
    },
  },

  // ── Sports nutrition ──────────────────────────────────────────────────────────────────────
  'Protein powder': {
    per: '100g',
    base: { kcal: 390, protein: 75.0, fat: 6.0, carbs: 8.0, sugar: 5.0, salt: 0.6 }, // whey concentrate, vanilla
    kinds: {
      'Whey, chocolate': {
        kcal: 380,
        protein: 72.0,
        fat: 6.0,
        carbs: 9.5,
        sugar: 5.0,
        fiber: 2.0,
        salt: 0.6,
      },
      'Whey, unflavoured': {
        kcal: 400,
        protein: 80.0,
        fat: 6.5,
        carbs: 5.5,
        sugar: 5.5,
        salt: 0.4,
      },
      'Whey isolate': { kcal: 370, protein: 88.0, fat: 1.0, carbs: 3.0, sugar: 1.5, salt: 0.5 },
      Casein: { kcal: 360, protein: 80.0, fat: 1.5, carbs: 6.0, sugar: 3.0, salt: 0.6 },
      'Vegan (pea)': {
        kcal: 380,
        protein: 80.0,
        fat: 6.5,
        carbs: 2.0,
        sugar: 0.5,
        fiber: 1.0,
        salt: 2.0,
      },
      'Egg white': { kcal: 375, protein: 80.0, fat: 0.5, carbs: 7.0, sugar: 5.0, salt: 3.0 },
    },
  },
  'Protein bar': {
    per: '100g',
    base: { kcal: 360, protein: 33.0, fat: 12.0, carbs: 30.0, sugar: 3.0, fiber: 8.0, salt: 0.5 }, // chocolate
    kinds: {
      Peanut: {
        kcal: 380,
        protein: 33.0,
        fat: 16.0,
        carbs: 26.0,
        sugar: 3.5,
        fiber: 7.0,
        salt: 0.6,
      },
      'Low sugar': {
        kcal: 345,
        protein: 33.0,
        fat: 11.0,
        carbs: 29.0,
        sugar: 1.0,
        fiber: 9.0,
        salt: 0.5,
      },
    },
  },
  'Mass gainer': {
    per: '100g',
    base: { kcal: 381, protein: 14.9, fat: 1.2, carbs: 76.0, sugar: 6.1, salt: 0.3 },
  },
  Creatine: { per: '100g', base: ZERO },

  // ── Drinks (per 100 ml) ───────────────────────────────────────────────────────────────────
  Water: { per: '100ml', base: WATER },
  'Sparkling water': {
    per: '100ml',
    base: WATER,
    kinds: { Borjomi: { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0.4 } },
  },
  'Mineral water': {
    per: '100ml',
    base: { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0.05 },
    kinds: {
      Borjomi: { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0.4 },
      Essentuki: { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0.7 },
    },
  },
  'Tonic water': { per: '100ml', base: { kcal: 37, protein: 0, fat: 0, carbs: 8.9, sugar: 8.9 } },
  Juice: {
    per: '100ml',
    base: { kcal: 46, protein: 0.1, fat: 0.1, carbs: 11.0, sugar: 10.0 }, // apple, 100 %
    kinds: {
      Orange: { kcal: 45, protein: 0.7, fat: 0.2, carbs: 10.0, sugar: 8.5 },
      'Mango-peach': { kcal: 52, protein: 0.3, fat: 0.1, carbs: 12.5, sugar: 12.0 },
      Multivitamin: { kcal: 50, protein: 0.3, fat: 0.1, carbs: 11.8, sugar: 11.0 },
      Multifruit: { kcal: 48, protein: 0.4, fat: 0.1, carbs: 11.2, sugar: 10.5 },
      Peach: { kcal: 50, protein: 0.3, fat: 0.1, carbs: 12.0, sugar: 11.5 },
      'Peach-banana': { kcal: 55, protein: 0.4, fat: 0.1, carbs: 13.0, sugar: 12.0 },
      Banana: { kcal: 56, protein: 0.4, fat: 0.1, carbs: 13.4, sugar: 12.0 },
      Cherry: { kcal: 52, protein: 0.3, fat: 0.1, carbs: 12.5, sugar: 12.0 },
      Grape: { kcal: 66, protein: 0.3, fat: 0.1, carbs: 16.0, sugar: 15.5 },
      Pineapple: { kcal: 50, protein: 0.3, fat: 0.1, carbs: 12.0, sugar: 11.0 },
      Pomegranate: { kcal: 54, protein: 0.2, fat: 0.3, carbs: 13.0, sugar: 12.6 },
      Grapefruit: { kcal: 39, protein: 0.5, fat: 0.1, carbs: 9.0, sugar: 8.0 },
      Tomato: { kcal: 17, protein: 0.8, fat: 0.2, carbs: 3.2, sugar: 2.6, fiber: 0.4, salt: 0.6 },
      Carrot: { kcal: 40, protein: 0.9, fat: 0.2, carbs: 9.0, sugar: 4.0, fiber: 0.8 },
    },
  },
  // Sodas: Moldovan/Romanian labels; Sprite and Mirinda are part-sweetened (~5 g sugar).
  'Coca-Cola': {
    per: '100ml',
    base: { kcal: 42, protein: 0, fat: 0, carbs: 10.6, sugar: 10.6 }, // classic; cherry, lime, vanilla alike
    kinds: { Zero: ZERO },
  },
  Pepsi: {
    per: '100ml',
    base: { kcal: 42, protein: 0, fat: 0, carbs: 10.6, sugar: 10.6 },
    kinds: { Zero: ZERO },
  },
  Sprite: {
    per: '100ml',
    base: { kcal: 20, protein: 0, fat: 0, carbs: 4.6, sugar: 4.6, salt: 0.04 },
    kinds: { Zero: ZERO },
  },
  Fanta: {
    per: '100ml',
    base: { kcal: 43, protein: 0, fat: 0, carbs: 10.5, sugar: 10.5 },
    kinds: { Zero: ZERO },
  },
  Mirinda: { per: '100ml', base: { kcal: 21, protein: 0, fat: 0, carbs: 5.0, sugar: 5.0 } },
  'Dr Pepper': {
    per: '100ml',
    base: { kcal: 41, protein: 0, fat: 0, carbs: 10.3, sugar: 10.3 },
    kinds: { Zero: ZERO },
  },
  '7UP': {
    per: '100ml',
    base: { kcal: 22, protein: 0, fat: 0, carbs: 5.4, sugar: 5.4 },
    kinds: { Free: ZERO },
  },
  Soda: { per: '100ml', base: { kcal: 35, protein: 0, fat: 0, carbs: 8.7, sugar: 8.7 } },
  Lemonade: { per: '100ml', base: { kcal: 40, protein: 0, fat: 0, carbs: 10.0, sugar: 10.0 } },
  'Iced tea': { per: '100ml', base: { kcal: 19, protein: 0, fat: 0, carbs: 4.6, sugar: 4.6 } },
  'Energy drink': {
    per: '100ml',
    base: { kcal: 46, protein: 0, fat: 0, carbs: 11.0, sugar: 11.0, salt: 0.25 },
  },
  Syrup: { per: '100ml', base: { kcal: 340, protein: 0, fat: 0, carbs: 84.0, sugar: 84.0 } }, // all flavours alike
  Kvass: { per: '100ml', base: { kcal: 27, protein: 0.2, fat: 0, carbs: 5.2, sugar: 4.5 } }, // ~0.7 % ABV
  Compote: {
    per: '100ml',
    base: { kcal: 45, protein: 0.2, fat: 0, carbs: 10.8, sugar: 10.5, fiber: 0.2 },
  },
  'Kefir drink': {
    per: '100ml',
    base: { kcal: 30, protein: 1.3, fat: 1.6, carbs: 2.0, sugar: 2.0, salt: 0.5 },
  }, // ayran, tan

  // ── Alcohol (per 100 ml; energy mostly from alcohol, 7 kcal/g) ───────────────────────────
  Beer: { per: '100ml', base: { kcal: 43, protein: 0.5, fat: 0, carbs: 3.6, sugar: 0.2 } }, // 5 %
  Wine: {
    per: '100ml',
    base: { kcal: 85, protein: 0.1, fat: 0, carbs: 2.6, sugar: 0.6 }, // red dry 13 %; white dry, rosé alike
    kinds: {
      'Red semi-sweet': { kcal: 81, protein: 0.1, fat: 0, carbs: 5.0, sugar: 4.0 }, // 11 %
      'White semi-sweet': { kcal: 81, protein: 0.1, fat: 0, carbs: 5.0, sugar: 4.0 }, // 11 %
    },
  },
  'Sparkling wine': {
    per: '100ml',
    base: { kcal: 72, protein: 0.2, fat: 0, carbs: 1.2, sugar: 1.0 }, // brut 12 %; prosecco alike
    kinds: {
      'Semi-dry': { kcal: 76, protein: 0.2, fat: 0, carbs: 3.0, sugar: 2.5 }, // 11.5 %
      'Semi-sweet': { kcal: 83, protein: 0.2, fat: 0, carbs: 5.0, sugar: 4.5 }, // 11.5 %
    },
  },
  Vodka: { per: '100ml', base: SPIRIT_40 },
  Divin: { per: '100ml', base: { kcal: 224, protein: 0, fat: 0, carbs: 0.5, sugar: 0.5 } }, // 40 %
  Whisky: { per: '100ml', base: SPIRIT_40 },
  Rum: {
    per: '100ml',
    base: SPIRIT_40, // white, dark
    kinds: { Spiced: { kcal: 204, protein: 0, fat: 0, carbs: 2.5, sugar: 2.5 } }, // 35 %
  },
  Gin: { per: '100ml', base: { kcal: 207, protein: 0, fat: 0, carbs: 0, sugar: 0 } }, // 37.5 %
  Tequila: { per: '100ml', base: { kcal: 210, protein: 0, fat: 0, carbs: 0, sugar: 0 } }, // 38 %
  Liqueur: {
    per: '100ml',
    base: { kcal: 290, protein: 0, fat: 0, carbs: 45.0, sugar: 45.0 }, // coffee, 20 %
    kinds: {
      Amaretto: { kcal: 287, protein: 0, fat: 0, carbs: 33.0, sugar: 33.0 }, // 28 %
      Cream: { kcal: 328, protein: 3.0, fat: 13.6, carbs: 25.0, sugar: 20.0, salt: 0.2 }, // 17 %
      'Blue Curaçao': { kcal: 244, protein: 0, fat: 0, carbs: 32.0, sugar: 32.0 }, // 21 %
      'Triple sec': { kcal: 286, protein: 0, fat: 0, carbs: 30.0, sugar: 30.0 }, // 30 %
    },
  },
  Vermouth: {
    per: '100ml',
    base: { kcal: 145, protein: 0, fat: 0, carbs: 15.5, sugar: 15.0 }, // bianco, rosso: 15 %
    kinds: { 'Extra dry': { kcal: 111, protein: 0, fat: 0, carbs: 3.0, sugar: 2.5 } }, // 18 %
  },

  // Household (toilet paper, paper towels, dish soap, laundry detergent, trash bags, foil, cling
  // film, baking paper, napkins, dishwasher tablets, sponges, hand soap): not food, no entry.
};
