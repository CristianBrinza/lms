import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every colour class used in the app is one the palette defines: Tailwind silently drops a class
 * like bg-mint-700 when there's no --color-mint-700, and the thing it colours just disappears.
 */
const root = join(__dirname, '..');
const css = readFileSync(join(__dirname, 'index.css'), 'utf8');
const defined = new Set([...css.matchAll(/--color-([a-z]+-\d+):/g)].map((m) => m[1]));
const PALETTES = [
  'ink',
  'butter',
  'lav',
  'mint',
  'cyan',
  'pink',
  'peach',
  'sky',
  'danger',
  'success',
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')
      ? [path]
      : [];
  });
}

describe('the palette', () => {
  it('defines every colour shade the app uses', () => {
    const pattern = new RegExp(
      `\\b(?:bg|text|ring|border|fill|stroke|from|to|via|outline|divide|shadow|accent|caret|decoration)-(${PALETTES.join('|')})-(\\d+)\\b`,
      'g',
    );
    const missing = new Set<string>();
    for (const file of files(root)) {
      for (const m of readFileSync(file, 'utf8').matchAll(pattern)) {
        const shade = `${m[1]}-${m[2]}`;
        if (!defined.has(shade)) missing.add(`${shade} (${file.slice(root.length + 1)})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
