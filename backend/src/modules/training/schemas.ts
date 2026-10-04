import { z } from 'zod';
import { dateField, idField, timeField } from '../food/schemas';
import { CATEGORIES, EQUIPMENT_KINDS, MEASURES, MUSCLES } from './catalog';

/**
 * Request shapes for Training, shared by the REST routes and the MCP tools. Descriptions double as
 * the tools' documentation. No defaults on anything a patch is built from: zod 4 fills defaults in
 * partial objects too, which would reset fields a patch never mentioned. The services fill them.
 */

const nameField = z
  .string()
  .trim()
  .min(1, 'Give it a name')
  .max(80, 'Keep the name under 80 characters');
const noteField = z.string().trim().max(500, 'Keep the note under 500 characters');
const kgField = z
  .number()
  .min(0, 'A weight can’t be negative')
  .max(500, 'That weight is too heavy');
const userField = idField
  .optional()
  .describe('Whose training (someone in the household); default: the caller');

export const PersonQuery = z.object({ userId: userField });

export const EquipmentInput = z.object({
  kind: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .describe(`One of ${EQUIPMENT_KINDS.join(', ')}, or "other"`),
  name: nameField.optional(),
  icon: z.string().trim().max(40).optional(),
  weights: z
    .array(kgField)
    .max(40)
    .optional()
    .describe('The weights owned, in kg (each dumbbell, kettlebell…)'),
  pairs: z.boolean().optional().describe('The weights come two of each (a pair of 8 kg dumbbells)'),
  count: z.number().int().min(0).max(100).optional(),
  note: noteField.optional(),
  variants: z
    .array(z.object({ name: z.string().trim().min(1).max(40), kg: kgField.nullable().optional() }))
    .max(30)
    .optional()
    .describe('Its pieces: each band with its resistance in kg, each grip of the bar'),
});
export type EquipmentInput = z.infer<typeof EquipmentInput>;
export const EquipmentPatch = EquipmentInput.omit({ kind: true }).partial();
export type EquipmentPatch = z.infer<typeof EquipmentPatch>;

const equipmentNeeds = z
  .array(z.array(z.string().trim().min(1).max(40)).max(4))
  .max(6)
  .describe('Alternatives, each a list of equipment kinds needed together; [] needs nothing');

export const ExerciseInput = z.object({
  name: nameField,
  category: z.enum(CATEGORIES),
  muscles: z.array(z.enum(MUSCLES)).max(6).optional(),
  secondary: z.array(z.enum(MUSCLES)).max(8).optional(),
  equipment: equipmentNeeds.optional(),
  measure: z
    .enum(MEASURES)
    .describe('reps (optionally with a weight), time held, or a distance with its time'),
  weighted: z.boolean().optional(),
  unilateral: z.boolean().optional().describe('Done one side at a time'),
  reps: z.number().int().min(1).max(1000).nullable().optional(),
  seconds: z.number().int().min(1).max(36_000).nullable().optional(),
  distance: z.number().int().min(1).max(500_000).nullable().optional().describe('Metres'),
  rest: z.number().int().min(0).max(1800).optional(),
  level: z.number().int().min(1).max(3).optional(),
  impact: z.enum(['low', 'high']).optional(),
  icon: z.string().trim().max(40).optional(),
  steps: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
  note: noteField.optional(),
  variants: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .optional()
    .describe('Ways to do it: grips, stances, positions'),
});
export type ExerciseInput = z.infer<typeof ExerciseInput>;
export const ExerciseCreate = ExerciseInput.extend({ userId: userField });
export type ExerciseCreate = z.infer<typeof ExerciseCreate>;
export const ExercisePatch = ExerciseInput.partial()
  .extend({ archived: z.boolean().optional() })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type ExercisePatch = z.infer<typeof ExercisePatch>;

/** One exercise in a workout: how many sets, and what each set aims for. */
export const WorkoutItem = z.object({
  exerciseId: idField,
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(1000).nullable().optional(),
  seconds: z.number().int().min(1).max(36_000).nullable().optional(),
  distance: z.number().int().min(1).max(500_000).nullable().optional().describe('Metres'),
  weight: kgField.nullable().optional(),
  rest: z
    .number()
    .int()
    .min(0)
    .max(1800)
    .optional()
    .describe('Seconds of rest after each set; default the exercise’s'),
  note: z.string().trim().max(200).optional(),
  variant: z
    .string()
    .trim()
    .max(60)
    .optional()
    .describe('Grip, stance or band: one of the exercise’s options'),
  block: z
    .enum(['warmup', 'main', 'cooldown'])
    .optional()
    .describe('Warm-up and cool-down are done once; rounds repeat the main block'),
});
export type WorkoutItem = z.infer<typeof WorkoutItem>;

const itemsField = z.array(WorkoutItem).max(40);
const roundsField = z
  .number()
  .int()
  .min(1)
  .max(20)
  .describe('Go through the whole list this many times (a circuit)');
const roundRestField = z.number().int().min(0).max(1800).describe('Seconds of rest between rounds');

export const RoutineInput = z.object({
  userId: userField,
  name: nameField,
  note: noteField.optional(),
  items: itemsField.min(1, 'Add an exercise'),
  rounds: roundsField.optional(),
  roundRest: roundRestField.optional(),
});
export type RoutineInput = z.infer<typeof RoutineInput>;
export const RoutinePatch = RoutineInput.omit({ userId: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type RoutinePatch = z.infer<typeof RoutinePatch>;

export const WorkoutInput = z.object({
  userId: userField,
  date: dateField,
  time: timeField.nullable().optional(),
  title: nameField.optional(),
  routineId: idField.optional().describe('Copy a saved routine’s exercises'),
  items: itemsField.optional(),
  rounds: roundsField.optional(),
  roundRest: roundRestField.optional(),
  note: noteField.optional(),
});
export type WorkoutInput = z.infer<typeof WorkoutInput>;

export const WorkoutPatch = z
  .object({
    date: dateField,
    time: timeField.nullable(),
    title: nameField,
    items: itemsField,
    rounds: roundsField,
    roundRest: roundRestField,
    note: noteField,
    status: z.enum(['planned', 'skipped']).describe('Back to planned, or skipped'),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type WorkoutPatch = z.infer<typeof WorkoutPatch>;

export const FinishInput = z.object({
  durationSeconds: z
    .number()
    .int()
    .min(0)
    .max(86_400)
    .optional()
    .describe('Time actually trained, pauses left out'),
  feeling: z.number().int().min(1).max(5).nullable().optional().describe('1 very hard … 5 great'),
  note: noteField.optional(),
});
export type FinishInput = z.infer<typeof FinishInput>;

/** One set done. In a workout it says which item, round and set it was. */
export const SetInput = z
  .object({
    userId: userField,
    exerciseId: idField,
    reps: z.number().int().min(0).max(5000).nullable().optional(),
    weight: kgField.nullable().optional(),
    seconds: z.number().int().min(0).max(86_400).nullable().optional(),
    distance: z.number().int().min(0).max(1_000_000).nullable().optional().describe('Metres'),
    side: z.enum(['left', 'right']).nullable().optional(),
    effort: z.number().int().min(1).max(10).nullable().optional().describe('How hard, 1–10'),
    note: z.string().trim().max(200).optional(),
    variant: z.string().trim().max(60).optional().describe('Grip, stance or band used'),
    clientId: z
      .uuid()
      .optional()
      .describe('The app’s own id for this set: sending it twice logs it once'),
    at: z.iso.datetime({ offset: true }).optional().describe('When it was done; default now'),
    day: dateField.optional().describe('Only the day is known ("sometime yesterday")'),
    itemIndex: z.number().int().min(0).max(40).optional(),
    round: z.number().int().min(1).max(20).optional(),
    setNumber: z.number().int().min(1).max(20).optional(),
  })
  .refine(
    (body) =>
      [body.reps, body.seconds, body.distance].some(
        (value) => value !== null && value !== undefined,
      ),
    'Say how many, how long or how far',
  );
export type SetInput = z.infer<typeof SetInput>;

export const SetPatch = z
  .object({
    reps: z.number().int().min(0).max(5000).nullable(),
    weight: kgField.nullable(),
    seconds: z.number().int().min(0).max(86_400).nullable(),
    distance: z.number().int().min(0).max(1_000_000).nullable(),
    effort: z.number().int().min(1).max(10).nullable(),
    note: z.string().trim().max(200),
    variant: z.string().trim().max(60),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type SetPatch = z.infer<typeof SetPatch>;

export const FOCUSES = ['full', 'upper', 'lower', 'core', 'cardio', 'mobility'] as const;
export type Focus = (typeof FOCUSES)[number];

export const GenerateInput = z.object({
  userId: userField,
  minutes: z.number().int().min(5).max(120).default(20),
  focus: z.enum(FOCUSES).default('full'),
  level: z.number().int().min(1).max(3).default(1),
  quiet: z.boolean().default(false).describe('No jumping: neighbours downstairs, a sleeping baby'),
  style: z
    .enum(['sets', 'circuit'])
    .default('sets')
    .describe('sets: each exercise’s sets in a row; circuit: rounds through all'),
});
export type GenerateInput = z.infer<typeof GenerateInput>;

export const RangeQuery = z.object({ userId: userField, from: dateField, to: dateField });
