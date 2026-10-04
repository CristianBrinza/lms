import type { SVGProps } from 'react';
import { cx } from '@/lib/cx';

/**
 * The training icons: one 48×48 file per exercise pose in ./exercise and per piece of equipment
 * in ./equipment, named by key (squat.svg, kettlebell.svg…). They are read as raw markup at build
 * time and drawn inline, so the ink outline (var(--color-ink-900)) follows the theme, the same way
 * the food icons are.
 *
 * Every exercise uses the same figure: a peach head and lavender outlined tubes for the torso and
 * limbs (the far-side limbs a lighter lavender), equipment in greys with one palette accent.
 */

const EXERCISE_FILES = import.meta.glob<string>('./exercise/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EQUIPMENT_FILES = import.meta.glob<string>('./equipment/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

interface TrainingIconArt {
  /** The root <svg> attributes, as React props (viewBox, fill, stroke…). */
  attrs: SVGProps<SVGSVGElement>;
  /** Everything inside the root <svg>. */
  inner: string;
}

const camel = (attr: string) => attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function parse(markup: string): TrainingIconArt | null {
  const match = /<svg\b([^>]*)>([\s\S]*)<\/svg>/.exec(markup);
  if (!match) return null;
  const attrs: Record<string, string> = {};
  for (const [, name, value] of match[1]!.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    if (name !== 'xmlns') attrs[camel(name!)] = value!;
  }
  return { attrs: attrs as SVGProps<SVGSVGElement>, inner: match[2]!.trim() };
}

function load(files: Record<string, string>): Record<string, TrainingIconArt> {
  const art: Record<string, TrainingIconArt> = {};
  for (const [path, markup] of Object.entries(files)) {
    const parsed = parse(markup);
    if (parsed) art[path.slice(path.lastIndexOf('/') + 1, -'.svg'.length)] = parsed;
  }
  return art;
}

const EXERCISE_ICON_ART = load(EXERCISE_FILES);
const EQUIPMENT_ICON_ART = load(EQUIPMENT_FILES);

/** Every exercise pose there is a file for, sorted. */
export const EXERCISE_ICON_KEYS: string[] = Object.keys(EXERCISE_ICON_ART).sort();
/** Every piece of equipment there is a file for, sorted. */
export const EQUIPMENT_ICON_KEYS: string[] = Object.keys(EQUIPMENT_ICON_ART).sort();

interface IconProps {
  name: string;
  className?: string;
  /** Announced as an image when set; decorative otherwise. */
  label?: string;
}

function TrainingSvg({
  art,
  className,
  label,
}: {
  art: TrainingIconArt;
  className?: string;
  label?: string;
}) {
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

/** An exercise pose. Unknown names fall back to the squat. */
export function ExerciseIcon({ name, className, label }: IconProps) {
  const art = EXERCISE_ICON_ART[name] ?? EXERCISE_ICON_ART.squat!;
  return <TrainingSvg art={art} className={className} label={label} />;
}

/** A piece of training equipment. Unknown names fall back to the mat. */
export function EquipmentIcon({ name, className, label }: IconProps) {
  const art = EQUIPMENT_ICON_ART[name] ?? EQUIPMENT_ICON_ART.mat!;
  return <TrainingSvg art={art} className={className} label={label} />;
}
