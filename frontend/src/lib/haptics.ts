/**
 * A light tap of feedback on phones that support it (Android; iOS Safari has no vibration API).
 * Short and rare: tab changes, toggles, a finished action, a refused one.
 */
type Feel = 'tap' | 'success' | 'error';

const PATTERNS: Record<Feel, number | number[]> = {
  tap: 8,
  success: [10, 40, 14],
  error: [18, 50, 18],
};

export function haptic(feel: Feel = 'tap'): void {
  try {
    navigator.vibrate?.(PATTERNS[feel]);
  } catch {
    // Not allowed here (no user gesture yet, or blocked): feedback stays visual.
  }
}
