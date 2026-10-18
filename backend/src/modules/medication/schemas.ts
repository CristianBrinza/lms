import { z } from 'zod';
import { dateField, timeField } from '../food/schemas';

export const FORMS = [
  'tablet',
  'capsule',
  'syrup',
  'drops',
  'spray',
  'cream',
  'injection',
  'sachet',
  'other',
] as const;
export const UNITS = ['pcs', 'ml', 'g', 'doses'] as const;
export const PACKAGE_KINDS = ['box', 'blister', 'bottle', 'tube'] as const;
export const PHOTO_KINDS = ['front', 'back', 'blister', 'leaflet', 'other'] as const;
export const INSTRUCTIONS = ['with_food', 'before_food', 'after_food', 'empty_stomach', 'with_water'] as const;
export const FILTERS = ['all', 'expiring', 'expired', 'low'] as const;

/** The unit a form is counted in, unless said otherwise. */
export const unitFor = (form: (typeof FORMS)[number]): (typeof UNITS)[number] =>
  form === 'syrup' || form === 'drops' ? 'ml' : form === 'cream' ? 'g' : form === 'spray' ? 'doses' : 'pcs';

const text = (max: number) => z.string().trim().max(max);
const amount = z.number().min(0).max(100_000);

export const MedicineInput = z.object({
  name: text(120).min(1, 'Say which medicine'),
  substance: text(120).optional().describe('The active substance (paracetamol)'),
  strength: text(60).optional().describe('As printed: 500 mg, 5 mg/ml'),
  form: z.enum(FORMS).optional().describe('tablet (default), capsule, syrup, drops, spray, cream, injection, sachet, other'),
  unit: z.enum(UNITS).optional().describe('What quantities count: pcs, ml, g, doses; default from the form'),
  rx: z.boolean().optional().describe('Needs a prescription'),
  color: text(40).optional(),
  shape: text(40).optional(),
  notes: text(2000).optional(),
  ownerId: z.uuid().nullable().optional().describe('One person’s medicine; omit for the household’s'),
});
export type MedicineInput = z.infer<typeof MedicineInput>;

export const MedicinePatch = MedicineInput.partial().refine(
  (body) => Object.keys(body).length > 0,
  'Nothing to change',
);
export type MedicinePatch = z.infer<typeof MedicinePatch>;

/** A date as printed on a box: a day, or just a month (YYYY-MM, meaning its last day). */
export const expiryField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Use a date like 2027-03-31 or a month like 2027-03')
  .refine((value) => {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12 && !Number.isNaN(Date.parse(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`));
  }, 'Not a real date');

export const PackageInput = z.object({
  kind: z.enum(PACKAGE_KINDS).optional().describe('box (default), blister, bottle, tube'),
  quantity: amount.describe('How much is left, in the medicine’s unit (tablets, ml…)'),
  original: amount.optional().describe('How much it held when new; default the quantity'),
  expiresOn: expiryField.nullable().optional().describe('YYYY-MM-DD, or YYYY-MM when only the month is printed'),
  batch: text(60).optional().describe('Batch / lot number'),
  openedOn: dateField.nullable().optional(),
  useWithinDays: z.number().int().min(1).max(3650).nullable().optional().describe('Use within N days after opening'),
  place: text(80).optional().describe('Where it is kept: "Bathroom cabinet", "Car kit"'),
});
export type PackageInput = z.infer<typeof PackageInput>;

export const PackagePatch = PackageInput.partial()
  .extend({ status: z.enum(['ok', 'finished', 'discarded']).optional() })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type PackagePatch = z.infer<typeof PackagePatch>;

const weekdays = z.array(z.number().int().min(1).max(7)).max(7);

export const TreatmentBase = z.object({
    medicineId: z.uuid(),
    personId: z.uuid().optional().describe('Who takes it; default you'),
    dose: z.number().positive().max(10_000).describe('Per intake, in the medicine’s unit (1 tablet, 5 ml)'),
    kind: z.enum(['times', 'interval', 'prn']).describe('times: fixed times a day; interval: every N hours; prn: as needed'),
    times: z.array(timeField).max(12).optional().describe('["08:00","14:00","20:00"]; for interval, the first time'),
    weekdays: weekdays.optional().describe('1 = Monday … 7 = Sunday; omit for every day'),
    intervalHours: z.number().int().min(1).max(72).optional(),
    maxPerDay: z.number().int().min(1).max(48).nullable().optional().describe('As needed: at most this many a day'),
    startOn: dateField.optional().describe('Default today'),
    endKind: z.enum(['none', 'date', 'days', 'doses']).optional(),
    endOn: dateField.nullable().optional(),
    endDays: z.number().int().min(1).max(730).nullable().optional(),
    endDoses: z.number().int().min(1).max(2000).nullable().optional(),
    instructions: z.array(z.enum(INSTRUCTIONS)).max(5).optional(),
    notes: text(2000).optional(),
    lowDays: z.number().int().min(1).max(60).optional().describe('Warn when the stock covers fewer days; default 5'),
});

export const TreatmentInput = TreatmentBase.superRefine((body, ctx) => {
    if (body.kind === 'times' && !body.times?.length)
      ctx.addIssue({ code: 'custom', path: ['times'], message: 'Add at least one time' });
    if (body.kind === 'interval' && !body.intervalHours)
      ctx.addIssue({ code: 'custom', path: ['intervalHours'], message: 'Say every how many hours' });
    if (body.endKind === 'date' && !body.endOn)
      ctx.addIssue({ code: 'custom', path: ['endOn'], message: 'Pick the last day' });
    if (body.endKind === 'days' && !body.endDays)
      ctx.addIssue({ code: 'custom', path: ['endDays'], message: 'Say for how many days' });
    if (body.endKind === 'doses' && !body.endDoses)
      ctx.addIssue({ code: 'custom', path: ['endDoses'], message: 'Say how many doses' });
  });
export type TreatmentInput = z.infer<typeof TreatmentInput>;

export const TreatmentPatch = z
  .object({
    dose: z.number().positive().max(10_000).optional(),
    times: z.array(timeField).max(12).optional(),
    weekdays: weekdays.optional(),
    intervalHours: z.number().int().min(1).max(72).optional(),
    maxPerDay: z.number().int().min(1).max(48).nullable().optional(),
    endKind: z.enum(['none', 'date', 'days', 'doses']).optional(),
    endOn: dateField.nullable().optional(),
    endDays: z.number().int().min(1).max(730).nullable().optional(),
    endDoses: z.number().int().min(1).max(2000).nullable().optional(),
    instructions: z.array(z.enum(INSTRUCTIONS)).max(5).optional(),
    notes: text(2000).optional(),
    lowDays: z.number().int().min(1).max(60).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type TreatmentPatch = z.infer<typeof TreatmentPatch>;

export const TakeInput = z.object({
  amount: z.number().positive().max(10_000).optional().describe('How much was taken; default the dose'),
  at: z.iso.datetime({ offset: true }).optional().describe('When it was taken; default now'),
  override: z.boolean().optional().describe('As needed: take it even past the daily maximum'),
});
export type TakeInput = z.infer<typeof TakeInput>;

export const SkipInput = z.object({ reason: text(200).optional() });
export type SkipInput = z.infer<typeof SkipInput>;
export const SnoozeInput = z.object({ minutes: z.union([z.literal(10), z.literal(30)]).optional() });

export const PhotoInput = z.object({
  image: z
    .string()
    .min(16)
    .max(17_000_000, 'That photo is too large')
    .describe('A data URL (data:image/jpeg;base64,…) or plain base64: JPEG, PNG, WebP or HEIC, up to 12 MB'),
  kind: z.enum(PHOTO_KINDS).optional().describe('front (default), back, blister, leaflet, other'),
});
export type PhotoInput = z.infer<typeof PhotoInput>;

export const PhotoPatch = z
  .object({ kind: z.enum(PHOTO_KINDS).optional(), cover: z.literal(true).optional() })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');

export const ListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z.enum(FILTERS).optional(),
  place: z.string().trim().max(80).optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;

export const DayQuery = z.object({ date: dateField.optional(), person: z.uuid().optional() });
export const RangeQuery = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  treatmentId: z.uuid().optional(),
  person: z.uuid().optional(),
});
