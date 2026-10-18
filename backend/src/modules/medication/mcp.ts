import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { householdPeople } from '../drinks/drinks';
import type { Tool, ToolEnv } from '../mcp/tools';
import { addMedicine, addPackage, updatePackage, type Package } from './cabinet';
import { openDoseOf, skipDose, takeAsNeeded, takeDose, undoDose } from './doses';
import { cabinet, medicineDetail } from './overview';
import { addPhoto } from './photos';
import {
  ListQuery,
  MedicineInput,
  PackageInput,
  PackagePatch,
  PhotoInput,
  TreatmentBase,
  TreatmentInput,
} from './schemas';
import { addTreatment, listTreatments, stopTreatment, type Treatment } from './treatments';

/**
 * The medicine cabinet over MCP: Claude adds medicines from photos of boxes, blisters and bottles
 * sent in a chat (name, strength, batch, expiry), keeps the counts, sets up treatments and logs
 * the doses. The same services as the app, so everything can be done without the screen.
 */

type Def<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  access: 'read' | 'write';
  destructive?: boolean;
  input: S;
  run: (env: ToolEnv, args: z.infer<S>) => Promise<unknown>;
};
const tool = <S extends z.ZodType>(def: Def<S>): Tool => def as unknown as Tool;

const personField = z
  .string()
  .trim()
  .max(120)
  .optional()
  .describe('Who: a household member’s name; default the key’s owner');

/** Someone named in the household ("Maria", "me") as a user id; undefined for the key owner. */
async function personId(env: ToolEnv, person: string | undefined): Promise<string | undefined> {
  if (!person || person.trim().toLowerCase() === 'me') return undefined;
  const wanted = person.trim().toLowerCase();
  const people = await householdPeople(env.ctx);
  const found = people.find(
    (p) =>
      p.id === person ||
      p.name.toLowerCase() === wanted ||
      `${p.name} ${p.surname}`.toLowerCase() === wanted,
  );
  if (!found) throw new AppError(400, 'VALIDATION', `No one called ${person} at home`);
  return found.id;
}

const packageBrief = (p: Package) => ({
  id: p.id,
  kind: p.kind,
  left: p.quantity,
  of: p.original,
  status: p.status,
  ...(p.expiresOn ? { expires: p.monthOnly ? p.expiresOn.slice(0, 7) : p.expiresOn } : {}),
  ...(p.effectiveExpiry && p.effectiveExpiry !== p.expiresOn ? { usableUntil: p.effectiveExpiry } : {}),
  ...(p.expiry.days !== null ? { daysToExpiry: p.expiry.days } : {}),
  ...(p.batch ? { batch: p.batch } : {}),
  ...(p.openedOn ? { opened: p.openedOn } : {}),
  ...(p.place ? { place: p.place } : {}),
});

const treatmentBrief = (t: Treatment) => ({
  id: t.id,
  medicine: [t.medicineName, t.strength].filter(Boolean).join(' '),
  person: t.personName,
  dose: `${t.dose} ${t.unit}`,
  schedule:
    t.kind === 'times'
      ? `${t.times.join(', ')}${t.weekdays.length ? ` on days ${t.weekdays.join(',')}` : ''}`
      : t.kind === 'interval'
        ? `every ${t.intervalHours} h from ${t.times[0] ?? '08:00'}`
        : `as needed${t.maxPerDay ? `, at most ${t.maxPerDay} a day` : ''}`,
  from: t.startOn,
  ...(t.courseEnd ? { until: t.courseEnd } : {}),
  status: t.status,
  ...(t.instructions.length ? { instructions: t.instructions } : {}),
  stockLeft: t.available,
  ...(t.daysLeft !== null ? { daysOfStock: t.daysLeft } : {}),
  ...(t.low ? { lowStock: true } : {}),
});

export const MEDICATION_TOOLS: Tool[] = [
  tool({
    name: 'medication_list',
    title: 'The medicine cabinet',
    description:
      'The household’s medicines with their packages (count left, expiry, batch, place) and the active treatments, plus what needs a look (expiring, expired, running low). q searches name, substance, strength, place; filter: all, expiring, expired, low. Check here before medication_add_medicine so a known medicine gets a new package instead of a duplicate. For one medicine in full, pass id.',
    access: 'read',
    input: ListQuery.extend({ id: z.uuid().optional() }),
    run: async (env, { id, ...query }) => {
      if (id) {
        const d = await medicineDetail(env.ctx, id);
        return {
          medicine: d.medicine,
          available: d.available,
          packages: d.packages.map(packageBrief),
          treatments: d.treatments.map(treatmentBrief),
          photos: d.photos.length,
        };
      }
      const view = await cabinet(env.ctx, query);
      const treatments = (await listTreatments(env.ctx)).filter((t) => t.status !== 'finished');
      return {
        counts: view.counts,
        summary: view.summary,
        medicines: view.medicines.map((m) => ({
          id: m.id,
          name: m.name,
          ...(m.substance ? { substance: m.substance } : {}),
          ...(m.strength ? { strength: m.strength } : {}),
          form: m.form,
          unit: m.unit,
          ...(m.rx ? { rx: true } : {}),
          ...(m.ownerName ? { owner: m.ownerName } : {}),
          available: m.available,
          state: m.state,
          ...(m.low ? { lowStock: true } : {}),
          packages: m.packages.map(packageBrief),
        })),
        treatments: treatments.map(treatmentBrief),
      };
    },
  }),
  tool({
    name: 'medication_add_medicine',
    title: 'Add a medicine',
    description:
      'A new medicine, from a photo of its box or bottle: name as printed, active substance, strength (500 mg, 5 mg/ml), form (tablet, capsule, syrup, drops, spray, cream, injection, sachet, other), rx when it needs a prescription. person: whose it is (omit: the household’s). Then medication_add_photo with the photos and medication_add_package with the batch, expiry and count. Never guess facts the photos don’t show.',
    access: 'write',
    input: MedicineInput.omit({ ownerId: true }).extend({ person: personField }),
    run: async (env, { person, ...input }) => {
      const owner = await personId(env, person);
      const { medicine } = await addMedicine(env.ctx, { ...input, ...(owner ? { ownerId: owner } : {}) });
      return medicine;
    },
  }),
  tool({
    name: 'medication_add_photo',
    title: 'Add a photo to a medicine',
    description:
      'A photo of a medicine: image as a data URL or plain base64 (JPEG, PNG, WebP or HEIC, up to 12 MB; shrunk on the server). kind: front (default; the first is the cover), back, blister, leaflet, other.',
    access: 'write',
    input: z.object({ medicineId: z.uuid() }).and(PhotoInput),
    run: async (env, { medicineId, ...input }) => {
      const { photo } = await addPhoto(env.ctx, medicineId, input);
      return { id: photo.id, kind: photo.kind, width: photo.width, height: photo.height, bytes: photo.bytes };
    },
  }),
  tool({
    name: 'medication_add_package',
    title: 'Add a package to a medicine',
    description:
      'A box, blister, bottle or tube of a medicine (medicineId from medication_list): quantity left in its unit (tablets, ml — count them with the person only when the number isn’t visible), original quantity, expiresOn (YYYY-MM-DD, or YYYY-MM when only the month is printed), batch/lot, openedOn and useWithinDays for an opened bottle, place ("Bathroom cabinet", "Car kit").',
    access: 'write',
    input: z.object({ medicineId: z.uuid() }).and(PackageInput),
    run: async (env, { medicineId, ...input }) => packageBrief((await addPackage(env.ctx, medicineId, input)).package),
  }),
  tool({
    name: 'medication_update_package',
    title: 'Change or discard a package',
    description:
      'Changes a package (id from medication_list): quantity (a recount), expiry, batch, openedOn, useWithinDays, place; status "discarded" throws an expired one away, "finished" when it is used up, "ok" brings it back.',
    access: 'write',
    destructive: true,
    input: z.object({ id: z.uuid() }).and(PackagePatch),
    run: async (env, { id, ...patch }) => packageBrief((await updatePackage(env.ctx, id, patch)).package),
  }),
  tool({
    name: 'medication_add_treatment',
    title: 'Start a treatment',
    description:
      'A medicine for a person on a schedule. dose per intake (1 tablet, 5 ml). kind "times" with explicit times ["08:00","14:00","20:00"] (optionally weekdays 1=Mon…7=Sun), "interval" every intervalHours from the first time, or "prn" as needed with maxPerDay. startOn (default today); end: endKind none, date (endOn), days (endDays), doses (endDoses). instructions: with_food, before_food, after_food, empty_stomach, with_water. lowDays: warn when the stock covers fewer days (default 5). Only what the person or the prescription said; no advice.',
    access: 'write',
    input: TreatmentBase.omit({ personId: true }).extend({ person: personField }),
    run: async (env, { person, ...input }) => {
      const owner = await personId(env, person);
      const parsed = TreatmentInput.parse({ ...input, ...(owner ? { personId: owner } : {}) });
      return treatmentBrief((await addTreatment(env.ctx, parsed)).treatment);
    },
  }),
  tool({
    name: 'medication_stop_treatment',
    title: 'End a treatment',
    description: 'Stops a treatment today (id from medication_list): no more doses are made; the history stays.',
    access: 'write',
    destructive: true,
    input: z.object({ id: z.uuid() }),
    run: async (env, { id }) => treatmentBrief((await stopTreatment(env.ctx, id)).treatment),
  }),
  tool({
    name: 'medication_log_dose',
    title: 'Log a dose',
    description:
      'Someone took (action "take", default), skipped ("skip", with reason) or un-took ("undo") a dose. Give doseId, or treatmentId: a scheduled treatment’s next open dose today, or an as-needed (prn) intake now (override true to go past its daily maximum). Taking counts the amount out of the package that expires first and isn’t expired. at: when it was taken (ISO 8601).',
    access: 'write',
    input: z.object({
      doseId: z.uuid().optional(),
      treatmentId: z.uuid().optional(),
      action: z.enum(['take', 'skip', 'undo']).optional(),
      amount: z.number().positive().max(10_000).optional(),
      at: z.iso.datetime({ offset: true }).optional(),
      reason: z.string().trim().max(200).optional(),
      override: z.boolean().optional(),
    }),
    run: async (env, args) => {
      const action = args.action ?? 'take';
      let doseId = args.doseId;
      if (!doseId) {
        if (!args.treatmentId) throw new AppError(400, 'VALIDATION', 'Give a doseId or a treatmentId');
        const treatment = (await listTreatments(env.ctx)).find((t) => t.id === args.treatmentId);
        if (!treatment) throw new AppError(404, 'NOT_FOUND', 'That treatment isn’t in your cabinet');
        if (treatment.kind === 'prn') {
          if (action !== 'take') throw new AppError(400, 'VALIDATION', 'An as-needed intake can only be taken');
          const { dose } = await takeAsNeeded(env.ctx, treatment.id, args);
          return { dose, stockLeft: (await listTreatments(env.ctx)).find((t) => t.id === treatment.id)?.available };
        }
        const open = await openDoseOf(env.ctx, treatment.id);
        if (!open) throw new AppError(409, 'CONFLICT', 'No dose of that treatment is open today');
        doseId = open.id;
      }
      if (action === 'skip') return (await skipDose(env.ctx, doseId, { reason: args.reason })).dose;
      if (action === 'undo') return (await undoDose(env.ctx, doseId)).dose;
      return (await takeDose(env.ctx, doseId, { amount: args.amount, at: args.at })).dose;
    },
  }),
  tool({
    name: 'medication_expiring',
    title: 'What is expiring',
    description:
      'Packages that expire within `days` (default 90) or already have, soonest first, with the medicine, place and count; expired ones are not stock and should be thrown away (medication_update_package, status discarded).',
    access: 'read',
    input: z.object({ days: z.number().int().min(1).max(730).optional() }),
    run: async (env, { days }) => {
      const view = await cabinet(env.ctx);
      const within = days ?? 90;
      const found = view.medicines
        .flatMap((m) =>
          m.packages
            .filter((p) => p.expiry.days !== null && p.expiry.days <= within)
            .map((p) => ({ medicine: [m.name, m.strength].filter(Boolean).join(' '), ...packageBrief(p) })),
        )
        .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));
      return { count: found.length, packages: found, ...view.summary };
    },
  }),
];
