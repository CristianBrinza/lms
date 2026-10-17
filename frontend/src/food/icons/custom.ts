import { useQuery } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { Translations } from '@/i18n';
import { foodApi, foodKeys } from '../api';

/**
 * The kitchen's own icons (custom:toast-bread…): drawings added at run time through the API or
 * Claude, so a new item gets its picture with no release. They arrive as a list of shapes, already
 * checked by the server; they are checked again here (defence in depth) and drawn with
 * createElement, never as markup: only the shape tags and the attributes below get through.
 */

export interface CustomShape {
  tag: string;
  attrs?: Record<string, string | number>;
  children?: CustomShape[];
}

export interface CustomIcon {
  key: string;
  name: string;
  translations?: Translations;
  shapes: CustomShape[];
  createdAt: string;
}

export const isCustomIcon = (key: string) => key.startsWith('custom:');

/** One cached list for every icon on screen. */
export function useCustomIcons(): CustomIcon[] {
  return (
    useQuery({ queryKey: foodKeys.icons, queryFn: foodApi.icons, staleTime: 5 * 60_000 }).data ?? []
  );
}

const TAGS = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g']);
const MAX_SHAPES = 60;
const MAX_DEPTH = 5;

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const PAINT = /^(?:none|currentColor|#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8}))$/i;
const PATH_DATA = /^[Mm][MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]*$/;
const POINTS = /^[0-9eE.,+\-\s]+$/;
const TRANSFORM =
  /^\s*(?:(?:translate|rotate|scale|matrix)\s*\(\s*[+-]?[0-9.]+(?:e[+-]?\d+)?(?:[\s,]+[+-]?[0-9.]+(?:e[+-]?\d+)?)*\s*\)[\s,]*)+$/i;
const DASHES = /^(?:none|[0-9.]+(?:[\s,]+[0-9.]+)*)$/;

const num = (value: string | number) =>
  (typeof value === 'number' ? Number.isFinite(value) : NUMBER.test(value)) ? value : null;
const text = (re: RegExp, max: number) => (value: string | number) =>
  typeof value === 'string' && value.length <= max && re.test(value) ? value : null;
const word =
  (...words: string[]) =>
  (value: string | number) =>
    typeof value === 'string' && words.includes(value) ? value : null;

/** Each allowed attribute: its React prop and what its value may be. */
const ATTRS: Record<string, [prop: string, check: (value: string | number) => unknown]> = {
  d: ['d', text(PATH_DATA, 8000)],
  cx: ['cx', num],
  cy: ['cy', num],
  r: ['r', num],
  rx: ['rx', num],
  ry: ['ry', num],
  x: ['x', num],
  y: ['y', num],
  width: ['width', num],
  height: ['height', num],
  x1: ['x1', num],
  y1: ['y1', num],
  x2: ['x2', num],
  y2: ['y2', num],
  points: ['points', text(POINTS, 4000)],
  transform: ['transform', text(TRANSFORM, 300)],
  fill: ['fill', text(PAINT, 9)],
  stroke: ['stroke', text(PAINT, 12)],
  'stroke-width': ['strokeWidth', num],
  'stroke-linecap': ['strokeLinecap', word('butt', 'round', 'square')],
  'stroke-linejoin': ['strokeLinejoin', word('miter', 'round', 'bevel')],
  'stroke-dasharray': ['strokeDasharray', text(DASHES, 100)],
  opacity: ['opacity', num],
  'fill-rule': ['fillRule', word('nonzero', 'evenodd')],
};

/**
 * The shapes as React elements. Anything outside the whitelist is dropped: an unknown tag with
 * everything inside it, an unknown attribute or a value of the wrong form on its own.
 */
export function drawShapes(shapes: unknown): ReactNode[] {
  let count = 0;
  const walk = (list: unknown, depth: number, path: string): ReactNode[] => {
    if (!Array.isArray(list) || depth > MAX_DEPTH) return [];
    const out: ReactNode[] = [];
    list.forEach((item: unknown, index) => {
      if (count >= MAX_SHAPES || !item || typeof item !== 'object') return;
      const { tag, attrs, children } = item as CustomShape;
      if (typeof tag !== 'string' || !TAGS.has(tag)) return;
      count += 1;
      const props: Record<string, unknown> = { key: `${path}${index}` };
      for (const [name, value] of Object.entries(attrs ?? {})) {
        const rule = Object.hasOwn(ATTRS, name) ? ATTRS[name] : undefined;
        if (!rule || (typeof value !== 'string' && typeof value !== 'number')) continue;
        const safe = rule[1](value);
        if (safe !== null) props[rule[0]] = safe;
      }
      out.push(
        tag === 'g'
          ? createElement('g', props, ...walk(children, depth + 1, `${path}${index}.`))
          : createElement(tag, props),
      );
    });
    return out;
  };
  return walk(shapes, 0, '');
}
