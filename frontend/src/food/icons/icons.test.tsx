/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { FOOD_ICON_KEYS, ICON_ART, ICON_NAMES, TOOL_ICON_KEYS } from './registry';

const BACKEND_FOOD = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../backend/src/modules/food',
);

/** The backend's own icon lists, read from its source so this test needs no backend build. */
function backendList(file: string, name: string): string[] {
  const source = readFileSync(resolve(BACKEND_FOOD, file), 'utf8');
  const block = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`).exec(source)?.[1];
  if (!block) throw new Error(`No ${name} in ${file}`);
  return [...block.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
}

const FOOD_ICONS = backendList('presets.ts', 'FOOD_ICONS');
const TOOL_ICONS = backendList('kitchenware.ts', 'TOOL_ICONS');

describe('food and kitchenware icons', () => {
  it('has a drawing for every food icon the API knows', () => {
    expect(FOOD_ICONS.length).toBeGreaterThan(50);
    expect(FOOD_ICONS.filter((key) => !ICON_NAMES.includes(key))).toEqual([]);
  });

  it('has a drawing for every kitchenware icon the API knows', () => {
    expect(TOOL_ICONS.length).toBeGreaterThan(20);
    expect(TOOL_ICONS.filter((key) => !ICON_NAMES.includes(key))).toEqual([]);
  });

  it('offers exactly the API lists in the pickers', () => {
    expect([...FOOD_ICON_KEYS].sort()).toEqual([...FOOD_ICONS].sort());
    expect([...TOOL_ICON_KEYS].sort()).toEqual([...TOOL_ICONS].sort());
  });

  it('keeps every file a clean 48×48 drawing with the themed ink outline', () => {
    for (const name of ICON_NAMES) {
      const { attrs, inner } = ICON_ART[name]!;
      expect(attrs.viewBox, name).toBe('0 0 48 48');
      expect(String(attrs.stroke), name).toContain('var(--color-ink-900');
      expect(inner, name).not.toMatch(/data-|<script|<title|gradient/i);
    }
  });
});

describe('Icon', () => {
  it('draws the named file inline, and falls back to the basket', () => {
    const tomato = renderToStaticMarkup(<Icon name="tomato" className="size-8" />);
    expect(tomato).toContain('viewBox="0 0 48 48"');
    expect(tomato).toContain('class="shrink-0 overflow-visible size-8"');
    expect(tomato).toContain('aria-hidden="true"');
    expect(tomato).toContain(ICON_ART.tomato!.inner.slice(0, 40));
    expect(renderToStaticMarkup(<Icon name="no-such-icon" />)).toContain(
      ICON_ART.basket!.inner.slice(0, 40),
    );
  });

  it('is announced as an image when labelled', () => {
    const banana = renderToStaticMarkup(<Icon name="banana" label="Bananas" />);
    expect(banana).toContain('role="img"');
    expect(banana).toContain('aria-label="Bananas"');
    expect(banana).not.toContain('aria-hidden');
  });
});
