/** Unit words people type, as the API spells them; packages and pieces pass through by name. */
const UNIT_WORDS: Record<string, string> = {
  pcs: 'pcs',
  pc: 'pcs',
  buc: 'pcs',
  x: 'pcs',
  g: 'g',
  gr: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  ltr: 'l',
};

/** Package and piece words that are units of their own ("2 cans corn", "10 slices bread"). */
const OWN_UNITS =
  'slices?|cans?|jars?|bottles?|packs?|bags?|boxes|box|loaf|loaves|pieces?|cubes?|trays?';

/**
 * What people type into a shopping list: "2 tomatoes", "1,5 kg potatoes", "milk 2 l", "eggs x10",
 * or just "bread". Returns the name and, when given, the amount and unit.
 */
export function parseLine(text: string): {
  name: string;
  amount: number | null;
  unit: string | null;
} {
  const clean = text.trim().replace(/\s+/g, ' ');
  const number = '(\\d+(?:[.,]\\d+)?)';
  const unit = `(pcs|pc|buc|x|g|gr|kg|ml|l|ltr|${OWN_UNITS})?`;
  const leading = new RegExp(`^${number}\\s*${unit}\\s+(.+)$`, 'i').exec(clean);
  const trailing = new RegExp(`^(.+?)\\s+(?:x\\s*)?${number}\\s*${unit}$`, 'i').exec(clean);
  const toNumber = (value: string) => Number(value.replace(',', '.'));
  const unitOf = (word: string | undefined) =>
    word ? (UNIT_WORDS[word.toLowerCase()] ?? word.toLowerCase()) : null;
  if (leading)
    return { name: leading[3]!, amount: toNumber(leading[1]!), unit: unitOf(leading[2]) };
  if (trailing)
    return { name: trailing[1]!, amount: toNumber(trailing[2]!), unit: unitOf(trailing[3]) };
  return { name: clean, amount: null, unit: null };
}
