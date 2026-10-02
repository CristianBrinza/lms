import { cx } from '@/lib/cx';
import { ICON_ART } from './registry';

/**
 * A food or kitchenware icon, drawn inline from its file in ./svg (48×48). Unknown names fall
 * back to the basket. With a label it is announced as an image; without one it is decorative.
 */
export function Icon({ name, className, label }: { name: string; className?: string; label?: string }) {
  const art = ICON_ART[name] ?? ICON_ART.basket!;
  return (
    <svg
      {...art.attrs}
      className={cx('shrink-0 overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: art.inner }}
    />
  );
}
