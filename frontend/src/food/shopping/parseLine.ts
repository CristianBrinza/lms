/**
 * Unit words people type, in English, Romanian or Russian, as the API spells them; packages and
 * pieces pass through by their English names ("conserve" → can, "бутылки" → bottle).
 */
const UNIT_WORDS: Record<string, string> = {
  pcs: 'pcs',
  pc: 'pcs',
  buc: 'pcs',
  'buc.': 'pcs',
  bucăți: 'pcs',
  bucati: 'pcs',
  шт: 'pcs',
  'шт.': 'pcs',
  x: 'pcs',
  g: 'g',
  gr: 'g',
  г: 'g',
  гр: 'g',
  kg: 'kg',
  кг: 'kg',
  ml: 'ml',
  мл: 'ml',
  l: 'l',
  ltr: 'l',
  л: 'l',
  felie: 'slice',
  felii: 'slice',
  conservă: 'can',
  conserva: 'can',
  conserve: 'can',
  borcan: 'jar',
  borcane: 'jar',
  sticlă: 'bottle',
  sticla: 'bottle',
  sticle: 'bottle',
  pachet: 'pack',
  pachete: 'pack',
  pungă: 'bag',
  punga: 'bag',
  pungi: 'bag',
  cutie: 'box',
  cutii: 'box',
  ломтик: 'slice',
  ломтика: 'slice',
  ломтиков: 'slice',
  банка: 'can',
  банки: 'can',
  банок: 'can',
  бутылка: 'bottle',
  бутылки: 'bottle',
  бутылок: 'bottle',
  упаковка: 'pack',
  упаковки: 'pack',
  упаковок: 'pack',
  пакет: 'bag',
  пакета: 'bag',
  пакетов: 'bag',
  коробка: 'box',
  коробки: 'box',
  коробок: 'box',
};

/** Package and piece words that are units of their own ("2 cans corn", "10 slices bread"). */
const OWN_UNITS =
  'slices?|cans?|jars?|bottles?|packs?|bags?|boxes|box|loaf|loaves|pieces?|cubes?|trays?';

const ENGLISH_UNITS = new Set(['pcs', 'pc', 'buc', 'x', 'g', 'gr', 'kg', 'ml', 'l', 'ltr']);

/** The other languages' words, longest first so "bucăți" wins over "buc". */
const LOCAL_UNITS = Object.keys(UNIT_WORDS)
  .filter((word) => !ENGLISH_UNITS.has(word))
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace('.', '\\.'))
  .join('|');

/**
 * What people type into a shopping list: "2 tomatoes", "1,5 kg potatoes", "milk 2 l", "eggs x10",
 * "2 kg de cartofi", "молоко 2 л", or just "bread". Returns the name and, when given, the amount
 * and unit.
 */
export function parseLine(text: string): {
  name: string;
  amount: number | null;
  unit: string | null;
} {
  const clean = text.trim().replace(/\s+/g, ' ');
  const number = '(\\d+(?:[.,]\\d+)?)';
  const unit = `(${LOCAL_UNITS}|pcs|pc|buc|x|g|gr|kg|ml|l|ltr|${OWN_UNITS})?`;
  const leading = new RegExp(`^${number}\\s*${unit}\\s+(.+)$`, 'i').exec(clean);
  const trailing = new RegExp(`^(.+?)\\s+(?:x\\s*)?${number}\\s*${unit}$`, 'i').exec(clean);
  const toNumber = (value: string) => Number(value.replace(',', '.'));
  const unitOf = (word: string | undefined) =>
    word ? (UNIT_WORDS[word.toLowerCase()] ?? word.toLowerCase()) : null;
  // "2 kg de cartofi": the Romanian "de" belongs to the amount, not the name.
  const nameOf = (name: string) => name.replace(/^de\s+/i, '');
  if (leading)
    return { name: nameOf(leading[3]!), amount: toNumber(leading[1]!), unit: unitOf(leading[2]) };
  if (trailing)
    return { name: trailing[1]!, amount: toNumber(trailing[2]!), unit: unitOf(trailing[3]) };
  return { name: clean, amount: null, unit: null };
}
