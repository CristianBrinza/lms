import type { CSSProperties } from 'react';

/**
 * The mark on the control to tap, the same on every drawing: an indigo line with a soft lavender
 * halo. It pops in once after its step (reduced motion: it is simply there).
 */
export const HIGHLIGHT = 'ring-[3px] ring-lav-600 outline-4 outline-offset-[3px] outline-lav-300/80 motion-safe:animate-pop';

/** Pops in just after its step card rises (the list staggers by 60 ms per step). */
export const highlightDelay = (step: number) => ({ animationDelay: `${Math.min(step * 60, 420) + 300}ms` });

/** The mark's class and timing for a control in a drawing of step `step`. */
export const mark = (step: number): { className: string; style: CSSProperties } => ({ className: HIGHLIGHT, style: highlightDelay(step) });
