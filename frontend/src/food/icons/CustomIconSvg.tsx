import { drawShapes, type CustomIcon } from './custom';

const INK = 'var(--color-ink-900, #1d1d24)';

/** The svg a custom icon is drawn in: the same grid and ink outline as the built-in files. */
export function CustomIconSvg({
  icon,
  className,
  label,
}: {
  icon: CustomIcon;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      color={INK}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {drawShapes(icon.shapes)}
    </svg>
  );
}
