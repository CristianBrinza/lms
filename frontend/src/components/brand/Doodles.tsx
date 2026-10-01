import { cx } from '@/lib/cx';

/**
 * The learning app's hand-drawn marks, drawn as strokes so they stay crisp at any size: a
 * scribbled underline, a loose flower, a star burst and a curly arrow. Decorative only.
 */

interface DoodleProps {
  className?: string;
}

/** Three loose strokes under a word, like a highlighter swiped twice. */
export function Scribble({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 240 28" fill="none" aria-hidden="true" className={cx('overflow-visible', className)} preserveAspectRatio="none">
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="5">
        <path d="M4 15C52 6 122 4 236 9" className="doodle-draw" style={{ animationDelay: '0ms' }} />
        <path d="M12 20C84 12 162 11 232 15" className="doodle-draw" style={{ animationDelay: '120ms' }} />
        <path d="M34 24C104 18 172 18 220 21" className="doodle-draw" style={{ animationDelay: '240ms' }} />
      </g>
    </svg>
  );
}

export function Flower({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className={className}>
      <path
        d="M60 60Q94.9 43.2 105.5 58.7Q95.8 74.8 60 60M60 60Q93.3 78.3 87 95.6Q68.6 97 60 60M60 60Q67.6 99.8 49.1 106.4Q35.5 92.2 60 60M60 60Q35.4 93.7 17.4 84.4Q18.5 64.1 60 60M60 60Q19 61.9 15 42.3Q31.2 30.7 60 60M60 60Q35 31.1 47 17Q64.8 22.1 60 60M60 60Q70.6 16.9 92.1 18.7Q99.2 39.1 60 60"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarBurst({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className={className}>
      <path
        d="M58.1 8.5L66.9 37.5L88.9 15.8L72.9 49.9L108.1 40.1L76.7 57L115.3 66.9L79.1 68L99.3 95L68.9 73.9L76.7 108.7L59.6 79.4L45.7 112.2L50.1 75.5L17.5 94.7L41.5 69L4.4 67.8L41.9 57L14.8 36.7L43.2 45.7L29.6 16.1L53 39.8Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A loop, then down to an arrowhead: "start here". */
export function CurlyArrow({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 110 120" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M104 22C80 4 44 14 58 34C70 51 100 40 88 24C74 7 30 30 30 98" />
        <path d="M14 80L30 100L46 80" />
      </g>
    </svg>
  );
}

/** A tangled ball of scribble, for round list thumbnails. */
export function ScribbleBall({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <path
        d="M18 32C13.8 37.6 38.6 19.1 32.3 34.8C38.2 46.3 13.7 26.6 19 25.7C45.7 40.8 23.5 30.8 47.4 46.9C26.4 23.9 40 34 32.9 17.9C35.1 39.8 17.6 33.2 30.1 43C18.1 30.3 46.6 22.8 30.6 24.9C50.1 31.7 14.3 34.9 26.1 23.3C27.8 48.7 18.9 28.2 43.1 28.4C39.7 29.9 23.2 38.5 45.1 31C40.8 30.9 25.4 47.5 40.9 24.6C48.7 42.2 16.6 42.4 19.8 23.9C46.1 42.4 25.6 40.3 33.9 30.3C35.5 40.9 18.5 21.6 19.7 29.5C36.5 51.1 12.8 30.1 25.7 44.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
