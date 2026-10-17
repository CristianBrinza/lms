import { formatNumber } from '@/i18n';
import { trainingT } from '../i18n';

/** Equipment weights: reading what was typed, and how a set of weights reads back. */

const MAX_KG = 500;

/**
 * "2 4 8", "2, 4, 8", "12,5 kg", "6/8/10kg" → kg, ascending, without repeats. A comma between
 * digits with one or two decimals after it ("12,5") is a decimal comma; otherwise commas separate.
 */
export function parseWeights(text: string): number[] {
  const found: number[] = [];
  for (const token of text
    .toLowerCase()
    .replace(/kg/g, ' ')
    .split(/[\s;/·+]+/)) {
    if (!token) continue;
    const parts = /^\d+,\d{1,2}$/.test(token) ? [token.replace(',', '.')] : token.split(',');
    for (const part of parts) {
      if (!/^\d+(\.\d+)?$/.test(part)) continue;
      const kg = Math.round(Number(part) * 100) / 100;
      if (kg > 0 && kg <= MAX_KG) found.push(kg);
    }
  }
  return sortWeights(found);
}

/** Ascending, each weight once. */
export function sortWeights(weights: number[]): number[] {
  return [...new Set(weights.map((kg) => Math.round(kg * 100) / 100))].sort((a, b) => a - b);
}

export const addWeights = (current: number[], more: number[]) => sortWeights([...current, ...more]);
export const removeWeight = (current: number[], kg: number) =>
  current.filter((value) => value !== kg);

const number = (kg: number) => formatNumber(kg, { maximumFractionDigits: 2 });

/** [2, 4, 8] in pairs → "2 · 4 · 8 kg, pairs"; [12] → "12 kg"; [] → "". */
export function weightsLabel(weights: number[], pairs: boolean): string {
  if (!weights.length) return '';
  const t = trainingT();
  const list = `${weights.map(number).join(' · ')} ${t.unit.kg}`;
  return pairs ? `${list}, ${t.pairs(weights.length)}` : list;
}

/** How many of a thing there are: 0 → "Not at home right now". */
export function countLabel(count: number): string {
  const { count: words } = trainingT();
  if (count <= 0) return words.none;
  return count === 1 ? words.one : words.many(count);
}
