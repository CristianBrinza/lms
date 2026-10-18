/** Which slide a horizontal scroll-snap strip is showing, from its scroll position. */
export function slideIndex(scrollLeft: number, width: number, count: number): number {
  if (count <= 0) return 0;
  const raw = Math.round(scrollLeft / Math.max(1, width));
  return Math.min(count - 1, Math.max(0, raw));
}
