import { cx } from '@/lib/cx';
import { isCustomIcon, useCustomIcons } from './custom';
import { CustomIconSvg } from './CustomIconSvg';
import { ICON_ART } from './registry';

/**
 * A food or kitchenware icon, drawn inline from its file in ./svg (48×48), or one of the
 * kitchen's own drawings for a custom:… key (see ./custom). Unknown names fall back to the basket.
 * With a label it is announced as an image; without one it is decorative.
 */
export function Icon({
  name,
  className,
  label,
}: {
  name: string;
  className?: string;
  label?: string;
}) {
  if (isCustomIcon(name)) return <KitchenIcon name={name} className={className} label={label} />;
  return <FileIcon name={name} className={className} label={label} />;
}

function FileIcon({
  name,
  className,
  label,
}: {
  name: string;
  className?: string;
  label?: string;
}) {
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

/** A custom:… key: the kitchen's own drawing, or the basket while it loads or once removed. */
function KitchenIcon({
  name,
  className,
  label,
}: {
  name: string;
  className?: string;
  label?: string;
}) {
  const icon = useCustomIcons().find((candidate) => candidate.key === name);
  if (!icon) return <FileIcon name="basket" className={className} label={label} />;
  return (
    <CustomIconSvg
      icon={icon}
      className={cx('shrink-0 overflow-visible', className)}
      label={label}
    />
  );
}
