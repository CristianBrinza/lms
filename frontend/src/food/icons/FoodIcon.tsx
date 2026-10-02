import { cx } from '@/lib/cx';
import { FOOD_ART, SCENE_ART } from './art';

/** A drawn food icon by key (tomato, steak, water…); unknown keys fall back to a basket. */
export function FoodIcon({ name, className, label }: { name: string; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cx('shrink-0 overflow-visible', className)} role={label ? 'img' : undefined} aria-hidden={label ? undefined : true}>
      {label ? <title>{label}</title> : null}
      {FOOD_ART[name] ?? FOOD_ART.basket}
    </svg>
  );
}

/** A food icon on its own soft tile, for rows and pickers. */
export function FoodIconTile({ name, className, tone = 'bg-ink-50' }: { name: string; className?: string; tone?: string }) {
  return (
    <span aria-hidden="true" className={cx('grid size-12 shrink-0 place-items-center rounded-2xl', tone, className)}>
      <FoodIcon name={name} className="size-[2.15rem]" />
    </span>
  );
}

/** The large drawing on each Food section card. */
export function SceneArt({ scene, className }: { scene: keyof typeof SCENE_ART; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cx('shrink-0 overflow-visible', className)}>
      {SCENE_ART[scene]}
    </svg>
  );
}
