import { INK } from './palette';

/** Drawing primitives for the Food section artwork (SCENE_ART): every stroke is ink, every corner round. */

/** An outlined shape. */
export function P({ d, f = 'none', w = 2.2 }: { d: string; f?: string; w?: number }) {
  return <path d={d} fill={f} stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}
export function C({ x, y, r, f = 'none', w = 2.2 }: { x: number; y: number; r: number; f?: string; w?: number }) {
  return <circle cx={x} cy={y} r={r} fill={f} stroke={INK} strokeWidth={w} />;
}
export function R({ x, y, w, h, r = 2, f = 'none', sw = 2.2 }: { x: number; y: number; w: number; h: number; r?: number; f?: string; sw?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={f} stroke={INK} strokeWidth={sw} />;
}

