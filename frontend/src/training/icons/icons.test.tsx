/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_ICON_KEYS,
  EXERCISE_ICON_KEYS,
  EquipmentIcon,
  ExerciseIcon,
} from './TrainingIcon';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A file's markup, and what is inside its root <svg>. */
function file(dir: 'exercise' | 'equipment', key: string) {
  const markup = readFileSync(resolve(HERE, dir, `${key}.svg`), 'utf8');
  const inner = /<svg\b[^>]*>([\s\S]*)<\/svg>/.exec(markup)?.[1]?.trim() ?? '';
  return { markup, inner };
}
const draw = (dir: 'exercise' | 'equipment', name: string, label?: string) =>
  renderToStaticMarkup(
    dir === 'exercise' ? (
      <ExerciseIcon name={name} label={label} />
    ) : (
      <EquipmentIcon name={name} label={label} />
    ),
  );

/** The drawings the training area needs: one pose per exercise, one object per piece of equipment. */
const EXERCISES = [
  'ab-wheel',
  'arm-circles',
  'band-pull-apart',
  'band-row',
  'bear-crawl',
  'bench-press',
  'bicycle-crunch',
  'bike',
  'bird-dog',
  'boxing',
  'bridge',
  'burpee',
  'calf-raise',
  'cat-cow',
  'chest-stretch',
  'childs-pose',
  'cobra',
  'crunch',
  'curl',
  'dead-bug',
  'deadlift',
  'decline-push-up',
  'diamond-push-up',
  'dip',
  'downward-dog',
  'farmer-carry',
  'floor-press',
  'fly',
  'foam-roller',
  'get-up',
  'goblet-squat',
  'hamstring-stretch',
  'hand-grip',
  'hang',
  'hanging-knee-raise',
  'high-knees',
  'hip-circles',
  'hip-flexor-stretch',
  'hip-thrust',
  'hollow-hold',
  'inchworm',
  'incline-push-up',
  'inverted-row',
  'jump-rope',
  'jump-squat',
  'jumping-jack',
  'kettlebell-swing',
  'knee-push-up',
  'lateral-raise',
  'leg-raise',
  'lunge',
  'lunge-twist',
  'march',
  'mountain-climber',
  'pike-push-up',
  'plank',
  'pull-up',
  'push-up',
  'quad-stretch',
  'row',
  'rowing',
  'run',
  'russian-twist',
  'shoulder-press',
  'shrug',
  'side-plank',
  'skater',
  'split-squat',
  'squat',
  'stairs',
  'step-up',
  'superman',
  'thruster',
  'treadmill',
  'triceps-extension',
  'walk',
  'wall-sit',
];

const EQUIPMENT = [
  'ab-wheel',
  'bands',
  'barbell',
  'bench',
  'chair',
  'dip-bars',
  'dumbbells',
  'exercise-bike',
  'fitness-ball',
  'foam-roller',
  'hand-grip',
  'jump-rope',
  'kettlebell',
  'mat',
  'medicine-ball',
  'parallettes',
  'pullup-bar',
  'rings',
  'route',
  'rower',
  'stairs',
  'step',
  'suspension',
  'treadmill',
  'weighted-vest',
  'yoga-block',
];

describe('training icons', () => {
  it('has a file for every exercise and every piece of equipment, and nothing else', () => {
    expect(EXERCISE_ICON_KEYS).toEqual([...EXERCISES].sort());
    expect(EQUIPMENT_ICON_KEYS).toEqual([...EQUIPMENT].sort());
  });

  it('keeps every file a clean 48×48 drawing with the themed ink outline, drawn by its component', () => {
    for (const [dir, keys] of [
      ['exercise', EXERCISES],
      ['equipment', EQUIPMENT],
    ] as const) {
      for (const key of keys) {
        const { markup, inner } = file(dir, key);
        expect(markup, key).toMatch(
          /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 48 48" [^>]*stroke="var\(--color-ink-900/,
        );
        expect(inner.length, key).toBeGreaterThan(0);
        expect(inner, key).not.toMatch(/data-|<script|<title|<style|<text|gradient|filter/i);
        const drawn = draw(dir, key);
        expect(drawn, key).toContain('viewBox="0 0 48 48"');
        expect(drawn, `${dir}/${key} parses`).toContain(inner.slice(0, 40));
      }
    }
  });
});

describe('ExerciseIcon and EquipmentIcon', () => {
  it('draw the named file inline, and fall back to the squat and the mat', () => {
    const plank = renderToStaticMarkup(<ExerciseIcon name="plank" className="size-8" />);
    expect(plank).toContain('class="shrink-0 overflow-visible size-8"');
    expect(plank).toContain('aria-hidden="true"');
    expect(draw('exercise', 'no-such-move')).toBe(draw('exercise', 'squat'));
    expect(draw('equipment', 'no-such-thing')).toBe(draw('equipment', 'mat'));
    expect(draw('exercise', 'plank')).not.toBe(draw('exercise', 'squat'));
  });

  it('are announced as an image when labelled', () => {
    const run = renderToStaticMarkup(<ExerciseIcon name="run" label="Run" />);
    expect(run).toContain('role="img"');
    expect(run).toContain('aria-label="Run"');
    expect(run).not.toContain('aria-hidden');
  });
});
