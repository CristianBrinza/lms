import type { Block, TrainingSet, Workout, WorkoutItemView } from '../types';

/**
 * A workout as the player walks it: one step at a time, every set (and every side of a one-sided
 * set) a work step, the rests between them as steps of their own. Warm-up and cool-down are done
 * once; the main block repeats `rounds` times, with `roundRest` between rounds.
 */

export type Side = 'left' | 'right' | null;

export interface WorkStep {
  kind: 'work';
  /** The item's place in workout.items (what the set is logged against). */
  itemIndex: number;
  /** 1-based; warm-up and cool-down are round 1. */
  round: number;
  /** How many rounds this item's block has (1 outside the main block). */
  rounds: number;
  /** 1-based. */
  setNumber: number;
  side: Side;
  block: Block;
  item: WorkoutItemView;
}

export interface RestStep {
  kind: 'rest';
  seconds: number;
  /** After a set, between rounds, or a moment to switch sides. */
  reason: 'set' | 'round' | 'side';
  /** The index of the work step that follows. */
  next: number;
}

export type Step = WorkStep | RestStep;

/** The short pause to swap sides in a one-sided set. */
export const SWITCH_SIDES_SECONDS = 5;

const blockOf = (item: WorkoutItemView): Block => item.block ?? 'main';

export function buildSteps(workout: Pick<Workout, 'items' | 'rounds' | 'roundRest'>): Step[] {
  const rounds = Math.max(1, workout.rounds || 1);
  const indexed = workout.items.map((item, itemIndex) => ({ item, itemIndex }));
  const warmup = indexed.filter(({ item }) => blockOf(item) === 'warmup');
  const main = indexed.filter(({ item }) => blockOf(item) === 'main');
  const cooldown = indexed.filter(({ item }) => blockOf(item) === 'cooldown');

  // Every work step, with the rest that should come after it.
  const work: Array<{ step: WorkStep; rest: number; reason: RestStep['reason'] }> = [];
  const add = (
    entries: typeof indexed,
    round: number,
    totalRounds: number,
    lastOfRound: boolean,
  ) => {
    entries.forEach(({ item, itemIndex }, position) => {
      const sides: Side[] = item.exercise.unilateral ? ['left', 'right'] : [null];
      const sets = Math.max(1, item.sets);
      for (let setNumber = 1; setNumber <= sets; setNumber++) {
        sides.forEach((side, sideIndex) => {
          const lastSide = sideIndex === sides.length - 1;
          const roundEnd = lastOfRound && position === entries.length - 1 && setNumber === sets;
          let rest = item.rest;
          let reason: RestStep['reason'] = 'set';
          if (!lastSide) {
            rest = SWITCH_SIDES_SECONDS;
            reason = 'side';
          } else if (roundEnd) {
            rest = workout.roundRest;
            reason = 'round';
          }
          work.push({
            step: {
              kind: 'work',
              itemIndex,
              round,
              rounds: totalRounds,
              setNumber,
              side,
              block: blockOf(item),
              item,
            },
            rest,
            reason,
          });
        });
      }
    });
  };

  add(warmup, 1, 1, false);
  for (let round = 1; round <= rounds; round++) add(main, round, rounds, round < rounds);
  add(cooldown, 1, 1, false);

  const steps: Step[] = [];
  work.forEach(({ step, rest, reason }, index) => {
    steps.push(step);
    const last = index === work.length - 1;
    if (!last && rest > 0)
      steps.push({ kind: 'rest', seconds: rest, reason, next: steps.length + 1 });
  });
  return steps;
}

// ---------------------------------------------------------------- what's already done

type Placed = Pick<WorkStep, 'itemIndex' | 'round' | 'setNumber' | 'side'>;

/** One work step's identity, the same for a step and the set logged for it. */
export const stepKey = ({ itemIndex, round, setNumber, side }: Placed) =>
  `${itemIndex}:${round}:${setNumber}:${side ?? '-'}`;

/**
 * The work steps the logged sets stand for. A set logged against an item without a set number
 * (from another screen) counts as the lowest set of that item and round not yet done.
 */
export function doneKeys(sets: TrainingSet[]): Set<string> {
  const keys = new Set<string>();
  const loose: TrainingSet[] = [];
  for (const set of sets) {
    if (set.itemIndex === null) continue;
    if (set.setNumber === null) loose.push(set);
    else
      keys.add(
        stepKey({
          itemIndex: set.itemIndex,
          round: set.round ?? 1,
          setNumber: set.setNumber,
          side: set.side,
        }),
      );
  }
  for (const set of loose) {
    for (let setNumber = 1; setNumber <= 20; setNumber++) {
      const key = stepKey({
        itemIndex: set.itemIndex!,
        round: set.round ?? 1,
        setNumber,
        side: set.side,
      });
      if (!keys.has(key)) {
        keys.add(key);
        break;
      }
    }
  }
  return keys;
}

export const isWork = (step: Step | undefined): step is WorkStep => step?.kind === 'work';

/**
 * Where to pick the workout up: the first work step not yet logged after the furthest one that
 * was (a set skipped on purpose stays skipped). 0 when nothing is logged; steps.length when
 * everything after the last logged set is done too.
 */
export function firstUndone(steps: Step[], sets: TrainingSet[]): number {
  const done = doneKeys(sets);
  let furthest = -1;
  steps.forEach((step, index) => {
    if (isWork(step) && done.has(stepKey(step))) furthest = index;
  });
  for (let index = furthest + 1; index < steps.length; index++) {
    const step = steps[index];
    if (isWork(step) && !done.has(stepKey(step))) return index;
  }
  return steps.length;
}

// ---------------------------------------------------------------- moving around

/** The next work step after `index` (not counting `index` itself), or -1. */
export function nextWork(steps: Step[], index: number): number {
  for (let i = index + 1; i < steps.length; i++) if (isWork(steps[i])) return i;
  return -1;
}

/** The work step before `index`, or -1. */
export function previousWork(steps: Step[], index: number): number {
  for (let i = Math.min(index, steps.length) - 1; i >= 0; i--) if (isWork(steps[i])) return i;
  return -1;
}

/** The work step a position belongs to: itself, or for a rest the one it leads to. */
export function workAt(steps: Step[], index: number): number {
  const step = steps[index];
  if (!step) return -1;
  return step.kind === 'work' ? index : step.next;
}

export interface Progress {
  /** Work steps in the workout. */
  total: number;
  /** Work steps logged. */
  done: number;
  /** 1-based number of the current (or coming) work step. */
  current: number;
}

export function progress(steps: Step[], index: number, done: Set<string>): Progress {
  let total = 0;
  let doneCount = 0;
  let current = 0;
  const at = workAt(steps, index);
  steps.forEach((step, i) => {
    if (!isWork(step)) return;
    total++;
    if (done.has(stepKey(step))) doneCount++;
    if (i <= at || at === -1) current = total;
  });
  return { total, done: doneCount, current: index >= steps.length ? total : current };
}

// ---------------------------------------------------------------- words

function spokenSeconds(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} ${s === 1 ? 'second' : 'seconds'}`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m} ${m === 1 ? 'minute' : 'minutes'}${rest ? ` ${rest} seconds` : ''}`;
}

function spokenDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} metres`;
  const km = Math.round(metres / 100) / 10;
  return `${km} ${km === 1 ? 'kilometre' : 'kilometres'}`;
}

/** "10 reps", "45 seconds", "3 kilometres": a work step's target, the way it's said aloud. */
export function spokenTarget(step: WorkStep): string {
  const { item } = step;
  const measure = item.exercise.measure;
  if (measure === 'time') return spokenSeconds(item.seconds ?? item.exercise.seconds ?? 30);
  if (measure === 'distance')
    return spokenDistance(item.distance ?? item.exercise.distance ?? 1000);
  const reps = item.reps ?? item.exercise.reps ?? 10;
  return `${reps} ${reps === 1 ? 'rep' : 'reps'}`;
}

/** What the voice says when a step begins. */
export function speechFor(steps: Step[], index: number): string {
  const step = steps[index];
  if (!step) return '';
  if (step.kind === 'work') {
    const side = step.side ? `, ${step.side} side` : '';
    return `${step.item.exercise.name}${side}. ${spokenTarget(step)}.`;
  }
  const next = steps[step.next];
  const nextName = isWork(next) ? next.item.exercise.name : '';
  if (step.reason === 'side') return 'Switch sides.';
  const what = step.reason === 'round' ? 'Rest between rounds' : 'Rest';
  return `${what}, ${spokenSeconds(step.seconds)}.${nextName ? ` Next: ${nextName}.` : ''}`;
}
