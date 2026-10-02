import type { Unit } from '../types';

const UNIT_WORDS: Record<string, Unit> = {
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

/**
 * What people type into a shopping list: "2 tomatoes", "1,5 kg potatoes", "milk 2 l", "eggs x10",
 * or just "bread". Returns the name and, when given, the amount and unit.
 */
export function parseLine(text: string): { name: string; amount: number | null; unit: Unit | null } {
  const clean = text.trim().replace(/\s+/g, ' ');
  const number = '(\\d+(?:[.,]\\d+)?)';
  const unit = '(pcs|pc|buc|x|g|gr|kg|ml|l|ltr)?';
  const leading = new RegExp(`^${number}\\s*${unit}\\s+(.+)$`, 'i').exec(clean);
  const trailing = new RegExp(`^(.+?)\\s+(?:x\\s*)?${number}\\s*${unit}$`, 'i').exec(clean);
  const toNumber = (value: string) => Number(value.replace(',', '.'));
  if (leading) return { name: leading[3]!, amount: toNumber(leading[1]!), unit: leading[2] ? UNIT_WORDS[leading[2].toLowerCase()]! : null };
  if (trailing) return { name: trailing[1]!, amount: toNumber(trailing[2]!), unit: trailing[3] ? UNIT_WORDS[trailing[3].toLowerCase()]! : null };
  return { name: clean, amount: null, unit: null };
}
