import { INK } from './palette';

/** Drawing primitives for the food icons: every stroke is ink, every corner round. */

/** An outlined shape. */
export function P({ d, f = 'none', w = 2.2 }: { d: string; f?: string; w?: number }) {
  return <path d={d} fill={f} stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}
/** A coloured line with no outline (stripes, marbling, kernels). */
export function L({ d, c, w = 2 }: { d: string; c: string; w?: number }) {
  return <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}
/** A flat filled shape with no outline (labels, liquid, seeds). */
export function F({ d, f }: { d: string; f: string }) {
  return <path d={d} fill={f} />;
}
export function C({ x, y, r, f = 'none', w = 2.2 }: { x: number; y: number; r: number; f?: string; w?: number }) {
  return <circle cx={x} cy={y} r={r} fill={f} stroke={INK} strokeWidth={w} />;
}
export function Dot({ x, y, r = 1.2, f = INK }: { x: number; y: number; r?: number; f?: string }) {
  return <circle cx={x} cy={y} r={r} fill={f} />;
}
export function R({ x, y, w, h, r = 2, f = 'none', sw = 2.2 }: { x: number; y: number; w: number; h: number; r?: number; f?: string; sw?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={f} stroke={INK} strokeWidth={sw} />;
}

