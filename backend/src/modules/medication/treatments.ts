import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import { addWish, listWishes } from '../wishlist/wishlist';
import {
  availableOf,
  findMedicine,
  listMedicines,
  listPackages,
  todayOf,
  type Medicine,
  type Package,
} from './cabinet';
import {
  courseEnd,
  dailyUse,
  doseTimes,
  isActive,
  lowStock,
  remainingDoses,
  type EndKind,
  type Schedule,
  type ScheduleKind,
} from './logic';
import type { TreatmentInput, TreatmentPatch } from './schemas';

/** Treatments: a medicine taken by a person on a schedule, for a course or as needed. */

export interface TreatmentRow {
  id: string;
  medicine_id: string;
  person_id: string;
  person_name: string;
  dose: number;
  kind: ScheduleKind;
  times: string[];
  weekdays: number[];
  interval_hours: number | null;
  max_per_day: number | null;
  start_on: string;
  end_kind: EndKind;
  end_on: string | null;
  end_days: number | null;
  end_doses: number | null;
  stopped_on: string | null;
  instructions: string[];
  notes: string;
  low_days: number;
  created_at: Date;
}

const SELECT = `SELECT t.id, t.medicine_id, t.person_id, u.name AS person_name, t.dose::float8 AS dose, t.kind,
    t.times, t.weekdays, t.interval_hours, t.max_per_day, t.start_on::text, t.end_kind, t.end_on::text,
    t.end_days, t.end_doses, t.stopped_on::text, t.instructions, t.notes, t.low_days, t.created_at
  FROM medication_treatments t JOIN users u ON u.id = t.person_id`;

export const scheduleOf = (row: TreatmentRow): Schedule => ({
  kind: row.kind,
  times: row.times,
  weekdays: row.weekdays,
  intervalHours: row.interval_hours,
  startOn: row.start_on,
  endKind: row.end_kind,
  endOn: row.end_on,
  endDays: row.end_days,
  endDoses: row.end_doses,
  stoppedOn: row.stopped_on,
});

export type TreatmentStatus = 'active' | 'upcoming' | 'finished';

function build(row: TreatmentRow, medicine: Medicine | undefined, packages: Package[], today: string) {
  const schedule = scheduleOf(row);
  const end = courseEnd(schedule);
  const status: TreatmentStatus =
    row.kind === 'prn' && !end
      ? 'active'
      : !isActive(schedule, today)
        ? 'finished'
        : row.start_on > today
          ? 'upcoming'
          : 'active';
  const available = availableOf(packages.filter((p) => p.medicineId === row.medicine_id), today);
  const daily = dailyUse(schedule, row.dose);
  const left = remainingDoses(schedule, today);
  const stock = lowStock({
    available,
    daily,
    lowDays: row.low_days,
    need: left === null ? null : left * row.dose,
  });
  return {
    id: row.id,
    medicineId: row.medicine_id,
    medicineName: medicine?.name ?? '',
    strength: medicine?.strength ?? '',
    form: medicine?.form ?? 'tablet',
    unit: medicine?.unit ?? 'pcs',
    cover: medicine?.cover ?? null,
    personId: row.person_id,
    personName: row.person_name,
    dose: row.dose,
    kind: row.kind,
    times: row.times,
    weekdays: row.weekdays,
    intervalHours: row.interval_hours,
    maxPerDay: row.max_per_day,
    startOn: row.start_on,
    endKind: row.end_kind,
    endOn: row.end_on,
    endDays: row.end_days,
    endDoses: row.end_doses,
    courseEnd: end,
    stoppedOn: row.stopped_on,
    status,
    instructions: row.instructions,
    notes: row.notes,
    lowDays: row.low_days,
    available,
    dailyUse: daily,
    daysLeft: stock.daysLeft,
    low: status !== 'finished' && stock.low,
    createdAt: row.created_at.toISOString(),
  };
}
export type Treatment = ReturnType<typeof build>;

export async function listTreatments(ctx: FoodCtx): Promise<Treatment[]> {
  const today = todayOf(ctx);
  const { rows } = await ctx.db.query<TreatmentRow>(
    `${SELECT} WHERE t.household_id = $1 ORDER BY t.start_on DESC, t.created_at DESC`,
    [ctx.actor.householdId],
  );
  if (!rows.length) return [];
  const [medicines, packages] = await Promise.all([listMedicines(ctx), listPackages(ctx)]);
  const byId = new Map(medicines.map((m) => [m.id, m]));
  return rows.map((row) => build(row, byId.get(row.medicine_id), packages, today));
}

export async function findTreatmentRow(ctx: FoodCtx, id: string): Promise<TreatmentRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That treatment isn’t in your cabinet');
  const { rows } = await ctx.db.query<TreatmentRow>(`${SELECT} WHERE t.id = $1 AND t.household_id = $2`, [
    id,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That treatment isn’t in your cabinet');
  return rows[0];
}

export async function findTreatment(ctx: FoodCtx, id: string): Promise<Treatment> {
  const row = await findTreatmentRow(ctx, id);
  const medicine = await findMedicine(ctx, row.medicine_id);
  const packages = await listPackages(ctx, [row.medicine_id]);
  return build(row, medicine, packages, todayOf(ctx));
}

async function checkPerson(ctx: FoodCtx, personId: string) {
  const { rows } = await ctx.db.query('SELECT 1 FROM users WHERE id = $1 AND household_id = $2 AND is_active', [
    personId,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(400, 'VALIDATION', 'No one at home by that id');
}

export async function addTreatment(ctx: FoodCtx, input: TreatmentInput) {
  await findMedicine(ctx, input.medicineId);
  const personId = input.personId ?? ctx.actor.userId;
  await checkPerson(ctx, personId);
  const times = [...new Set(input.times ?? [])].sort();
  const id = randomUUID();
  await ctx.db.query(
    `INSERT INTO medication_treatments (id, household_id, medicine_id, person_id, dose, kind, times, weekdays,
       interval_hours, max_per_day, start_on, end_kind, end_on, end_days, end_doses, instructions, notes,
       low_days, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)`,
    [
      id,
      ctx.actor.householdId,
      input.medicineId,
      personId,
      input.dose,
      input.kind,
      input.kind === 'prn' ? [] : input.kind === 'interval' && !times.length ? ['08:00'] : times,
      input.kind === 'times' ? [...new Set(input.weekdays ?? [])].sort() : [],
      input.kind === 'interval' ? (input.intervalHours ?? null) : null,
      input.kind === 'prn' ? (input.maxPerDay ?? null) : null,
      input.startOn ?? todayOf(ctx),
      input.endKind ?? 'none',
      input.endKind === 'date' ? input.endOn : null,
      input.endKind === 'days' ? input.endDays : null,
      input.endKind === 'doses' && input.kind !== 'prn' ? input.endDoses : null,
      input.instructions ?? [],
      input.notes ?? '',
      input.lowDays ?? 5,
      ctx.now,
    ],
  );
  return { treatment: await findTreatment(ctx, id) };
}

export async function updateTreatment(ctx: FoodCtx, id: string, patch: TreatmentPatch) {
  const row = await findTreatmentRow(ctx, id);
  const columns: Record<string, [string, (v: never) => unknown]> = {
    dose: ['dose', (v) => v],
    times: ['times', (v: string[]) => [...new Set(v)].sort()],
    weekdays: ['weekdays', (v: number[]) => [...new Set(v)].sort()],
    intervalHours: ['interval_hours', (v) => v],
    maxPerDay: ['max_per_day', (v) => v],
    endKind: ['end_kind', (v) => v],
    endOn: ['end_on', (v) => v],
    endDays: ['end_days', (v) => v],
    endDoses: ['end_doses', (v) => v],
    instructions: ['instructions', (v) => v],
    notes: ['notes', (v) => v],
    lowDays: ['low_days', (v) => v],
  };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, [column, convert]] of Object.entries(columns)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    values.push(convert(value as never));
    sets.push(`${column} = $${values.length}`);
  }
  values.push(ctx.now);
  await ctx.db.query(
    `UPDATE medication_treatments SET ${sets.join(', ')}, updated_at = $${values.length} WHERE id = $1`,
    values,
  );
  // Doses still waiting come out again from the new schedule; what was taken or skipped stays.
  if (['times', 'weekdays', 'intervalHours', 'endKind', 'endOn', 'endDays', 'endDoses', 'dose'].some((k) => k in patch))
    await ctx.db.query(
      `DELETE FROM medication_doses WHERE treatment_id = $1 AND status = 'due' AND due_on >= $2::date AND due_time IS NOT NULL`,
      [row.id, todayOf(ctx)],
    );
  return { treatment: await findTreatment(ctx, id) };
}

/** Ends the course today: no more doses are made, what was taken stays in the history. */
export async function stopTreatment(ctx: FoodCtx, id: string) {
  const row = await findTreatmentRow(ctx, id);
  const today = todayOf(ctx);
  if (!row.stopped_on || row.stopped_on > today)
    await ctx.db.query('UPDATE medication_treatments SET stopped_on = $2, updated_at = $3 WHERE id = $1', [
      id,
      today,
      ctx.now,
    ]);
  await ctx.db.query(
    `DELETE FROM medication_doses WHERE treatment_id = $1 AND status = 'due' AND due_on >= $2::date`,
    [id, today],
  );
  return { treatment: await findTreatment(ctx, id) };
}

export async function removeTreatment(ctx: FoodCtx, id: string) {
  await findTreatmentRow(ctx, id);
  await ctx.db.query('DELETE FROM medication_treatments WHERE id = $1', [id]);
}

/** Scheduled dose slots (time, per treatment row) a day has. */
export const slotsOn = (row: TreatmentRow, date: string) => doseTimes(scheduleOf(row), date);

/** Every treatment of the household that has doses on a date, for generating them. */
export async function treatmentRowsOn(ctx: FoodCtx, date: string): Promise<TreatmentRow[]> {
  const { rows } = await ctx.db.query<TreatmentRow>(
    `${SELECT} WHERE t.household_id = $1 AND t.kind <> 'prn' AND t.start_on <= $2::date`,
    [ctx.actor.householdId, date],
  );
  return rows;
}

/**
 * "Add to the buy list" for a medicine running low: one wish on the priority buy list, never
 * made on its own. Asking twice returns the same wish.
 */
export async function addToBuyList(ctx: FoodCtx, treatmentId: string) {
  const treatment = await findTreatment(ctx, treatmentId);
  const name = [treatment.medicineName, treatment.strength].filter(Boolean).join(' ');
  const existing = (await listWishes(ctx)).items.find(
    (w) => w.status === 'wanted' && w.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return { item: existing, already: true };
  const days = treatment.daysLeft;
  const { item } = await addWish(ctx, {
    name,
    note: `Medication for ${treatment.personName}${days !== null ? `: about ${days} day${days === 1 ? '' : 's'} left` : ''}`,
    urgency: 'now',
    category: 'Medication',
    shared: true,
    top: true,
  });
  return { item, already: false };
}
