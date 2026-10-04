import { describe, expect, it } from 'vitest';
import type { LibraryExercise, TrainingSet, WorkoutItemView } from '../types';
import {
  buildSteps,
  doneKeys,
  firstUndone,
  nextWork,
  previousWork,
  progress,
  speechFor,
  stepKey,
  SWITCH_SIDES_SECONDS,
  type Step,
  type WorkStep,
} from './sequence';

function exercise(over: Partial<LibraryExercise> = {}): LibraryExercise {
  return {
    id: over.id ?? 'ex-push',
    userId: 'u',
    preset: null,
    variants: [],
    options: [],
    name: 'Push-ups',
    category: 'strength',
    muscles: ['chest'],
    secondary: [],
    equipment: [],
    measure: 'reps',
    weighted: false,
    unilateral: false,
    reps: 10,
    seconds: null,
    distance: null,
    rest: 60,
    level: 1,
    impact: 'low',
    icon: 'pushup',
    steps: [],
    note: '',
    archived: false,
    available: true,
    uses: null,
    weights: [],
    pinned: false,
    ...over,
  };
}

function item(
  over: Partial<WorkoutItemView> & { ex?: Partial<LibraryExercise> } = {},
): WorkoutItemView {
  const { ex, ...rest } = over;
  const lib = exercise(ex);
  return {
    exerciseId: lib.id,
    sets: 1,
    reps: 10,
    rest: 60,
    exercise: lib,
    last: null,
    suggest: null,
    ...rest,
  };
}

const workout = (items: WorkoutItemView[], rounds = 1, roundRest = 90) => ({
  items,
  rounds,
  roundRest,
});

/** A compact picture of the steps: "w0.1.1" work (item.round.set[side]), "r60" rest. */
function shape(steps: Step[]): string[] {
  return steps.map((step) =>
    step.kind === 'work'
      ? `w${step.itemIndex}.${step.round}.${step.setNumber}${step.side ? step.side[0] : ''}`
      : `r${step.seconds}${step.reason === 'set' ? '' : step.reason[0]}`,
  );
}

function set(over: Partial<TrainingSet>): TrainingSet {
  return {
    id: Math.random().toString(36),
    userId: 'u',
    variant: '',
    exerciseId: 'ex-push',
    exercise: 'Push-ups',
    icon: 'pushup',
    workoutId: 'w',
    itemIndex: 0,
    round: 1,
    setNumber: 1,
    side: null,
    reps: 10,
    weight: null,
    seconds: null,
    distance: null,
    performedAt: '2026-10-04T08:00:00Z',
    day: '2026-10-04',
    timeKnown: true,
    effort: null,
    note: '',
    ...over,
  };
}

describe('buildSteps', () => {
  it('does each set with its rest between, and no rest after the very last set', () => {
    const steps = buildSteps(workout([item({ sets: 3, rest: 45 }), item({ sets: 2, rest: 30 })]));
    expect(shape(steps)).toEqual([
      'w0.1.1',
      'r45',
      'w0.1.2',
      'r45',
      'w0.1.3',
      'r45',
      'w1.1.1',
      'r30',
      'w1.1.2',
    ]);
  });

  it('points every rest at the work step after it', () => {
    const steps = buildSteps(workout([item({ sets: 2 }), item({ sets: 1 })]));
    steps.forEach((step, index) => {
      if (step.kind === 'rest') {
        expect(step.next).toBe(index + 1);
        expect(steps[step.next]?.kind).toBe('work');
      }
    });
  });

  it('leaves the rest out when it is 0', () => {
    const steps = buildSteps(workout([item({ sets: 2, rest: 0 }), item({ sets: 1, rest: 0 })]));
    expect(shape(steps)).toEqual(['w0.1.1', 'w0.1.2', 'w1.1.1']);
  });

  it('does a one-sided exercise left then right, with a short switch between', () => {
    const steps = buildSteps(workout([item({ sets: 2, rest: 40, ex: { unilateral: true } })]));
    expect(shape(steps)).toEqual([
      'w0.1.1l',
      `r${SWITCH_SIDES_SECONDS}s`,
      'w0.1.1r',
      'r40',
      'w0.1.2l',
      `r${SWITCH_SIDES_SECONDS}s`,
      'w0.1.2r',
    ]);
    expect((steps[0] as WorkStep).side).toBe('left');
  });

  it('repeats the main block in rounds, resting roundRest between rounds', () => {
    const steps = buildSteps(workout([item({ rest: 15 }), item({ rest: 20 })], 3, 90));
    expect(shape(steps)).toEqual([
      'w0.1.1',
      'r15',
      'w1.1.1',
      'r90r',
      'w0.2.1',
      'r15',
      'w1.2.1',
      'r90r',
      'w0.3.1',
      'r15',
      'w1.3.1',
    ]);
    expect((steps[0] as WorkStep).rounds).toBe(3);
  });

  it('does the warm-up and the cool-down once around the rounds', () => {
    const steps = buildSteps(
      workout(
        [
          item({ rest: 10, block: 'warmup' }),
          item({ rest: 15 }),
          item({ rest: 20, block: 'main' }),
          item({ rest: 0, block: 'cooldown' }),
        ],
        2,
        60,
      ),
    );
    expect(shape(steps)).toEqual([
      'w0.1.1',
      'r10',
      'w1.1.1',
      'r15',
      'w2.1.1',
      'r60r',
      'w1.2.1',
      'r15',
      'w2.2.1',
      'r20',
      'w3.1.1',
    ]);
    const warm = steps[0] as WorkStep;
    const cool = steps.at(-1) as WorkStep;
    expect([warm.block, warm.rounds, cool.block, cool.rounds]).toEqual([
      'warmup',
      1,
      'cooldown',
      1,
    ]);
  });

  it('keeps the items’ own places even when blocks are listed out of order', () => {
    const steps = buildSteps(workout([item({ rest: 0 }), item({ rest: 0, block: 'warmup' })]));
    expect(shape(steps)).toEqual(['w1.1.1', 'w0.1.1']);
  });

  it('has nothing to play for an empty workout', () => {
    expect(buildSteps(workout([]))).toEqual([]);
  });
});

describe('resuming', () => {
  const steps = buildSteps(
    workout([item({ sets: 2, rest: 30, ex: { unilateral: true } }), item({ sets: 2 })], 1),
  );

  it('starts at the beginning when nothing is logged', () => {
    expect(firstUndone(steps, [])).toBe(0);
  });

  it('matches logged sets by item, round, set and side', () => {
    const keys = doneKeys([set({ side: 'left' }), set({ itemIndex: 1, setNumber: 2 })]);
    expect(keys.has(stepKey({ itemIndex: 0, round: 1, setNumber: 1, side: 'left' }))).toBe(true);
    expect(keys.has(stepKey({ itemIndex: 0, round: 1, setNumber: 1, side: 'right' }))).toBe(false);
    expect(keys.has(stepKey({ itemIndex: 1, round: 1, setNumber: 2, side: null }))).toBe(true);
  });

  it('picks up after the last logged set', () => {
    const sets = [
      set({ side: 'left' }),
      set({ side: 'right' }),
      set({ setNumber: 2, side: 'left' }),
    ];
    const index = firstUndone(steps, sets);
    expect(steps[index]).toMatchObject({ kind: 'work', itemIndex: 0, setNumber: 2, side: 'right' });
  });

  it('leaves a set skipped on purpose behind', () => {
    // Set 1 of the second exercise done, the whole first exercise skipped.
    const index = firstUndone(steps, [set({ itemIndex: 1, setNumber: 1 })]);
    expect(steps[index]).toMatchObject({ itemIndex: 1, setNumber: 2 });
  });

  it('is at the end when everything is logged', () => {
    const all = steps
      .filter((s): s is WorkStep => s.kind === 'work')
      .map(({ itemIndex, round, setNumber, side }) => set({ itemIndex, round, setNumber, side }));
    expect(firstUndone(steps, all)).toBe(steps.length);
  });

  it('places a set logged without a set number on the first free set of its item', () => {
    const keys = doneKeys([
      set({ itemIndex: 1, setNumber: 1 }),
      set({ itemIndex: 1, setNumber: null }),
    ]);
    expect(keys.has(stepKey({ itemIndex: 1, round: 1, setNumber: 2, side: null }))).toBe(true);
  });

  it('ignores sets logged outside the workout’s items', () => {
    expect(doneKeys([set({ itemIndex: null })]).size).toBe(0);
  });

  it('counts progress through the work steps', () => {
    const done = doneKeys([set({ side: 'left' })]);
    // The first rest (switch sides) leads to work step 2 of 6.
    expect(progress(steps, 1, done)).toEqual({ total: 6, done: 1, current: 2 });
    expect(progress(steps, steps.length, done).current).toBe(6);
  });

  it('moves between work steps over the rests', () => {
    expect(nextWork(steps, 0)).toBe(2);
    expect(previousWork(steps, 2)).toBe(0);
    expect(previousWork(steps, 0)).toBe(-1);
    expect(nextWork(steps, steps.length - 1)).toBe(-1);
  });
});

describe('speechFor', () => {
  it('says the exercise, the side and the target', () => {
    const steps = buildSteps(
      workout([
        item({ sets: 1, rest: 60, ex: { unilateral: true, name: 'Lunges' }, reps: 12 }),
        item({ ex: { name: 'Plank', measure: 'time' }, seconds: 45, reps: null }),
      ]),
    );
    expect(speechFor(steps, 0)).toBe('Lunges, left side. 12 reps.');
    expect(speechFor(steps, 1)).toBe('Switch sides.');
    expect(speechFor(steps, 3)).toBe('Rest, 1 minute. Next: Plank.');
    expect(speechFor(steps, 4)).toBe('Plank. 45 seconds.');
  });
});
