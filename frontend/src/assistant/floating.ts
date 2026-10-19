/** Marks a fixed or sticky bottom element (FAB, selection bar, save bar) the assistant button must not cover. */
export const FLOATING_ATTR = 'data-fab';

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Where the assistant button sits so it never covers a page's own floating control: the bottom
 * offset (px from the viewport bottom) just above the topmost marked element that is in its way,
 * or null when nothing is. `base` is the button's resting offset, `size` its diameter, `inset`
 * its distance from the right edge.
 */
export function stackedBottom(input: {
  obstacles: Box[];
  viewport: { width: number; height: number };
  base: number;
  size: number;
  inset: number;
  gap?: number;
}): number | null {
  const { obstacles, viewport, base, size, inset, gap = 12 } = input;
  const zoneTop = viewport.height - base - size - gap;
  const zoneLeft = viewport.width - inset - size;
  let top: number | null = null;
  for (const box of obstacles) {
    const visible =
      box.right > box.left && box.bottom > box.top && box.top < viewport.height && box.bottom > 0;
    if (!visible) continue;
    if (box.right <= zoneLeft || box.left >= viewport.width - inset) continue;
    if (box.bottom <= zoneTop) continue;
    top = top === null ? box.top : Math.min(top, box.top);
  }
  return top === null ? null : Math.max(base, viewport.height - top + gap);
}

const OVERLAY = 'dialog[open], [role=dialog], [aria-modal=true]';
const TEXT_INPUT =
  'input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=range],[type=file],[type=color]), textarea, [contenteditable=true], [contenteditable=""]';

/** A sheet, dialog or full-screen viewer is open. */
export function overlayOpen(doc: Document = document): boolean {
  return doc.querySelector(OVERLAY) !== null;
}

/** The on-screen keyboard is probably up: the visual viewport shrank, or a text field has focus. */
export function keyboardUp(win: Window = window): boolean {
  const vv = win.visualViewport;
  if (vv && win.innerHeight - vv.height > 150) return true;
  const el = win.document.activeElement;
  return Boolean(el && el.matches(TEXT_INPUT));
}
