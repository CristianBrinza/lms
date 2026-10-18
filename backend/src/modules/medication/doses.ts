import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { isUuid } from '../users';
import { asStock, listPackages, todayOf } from './cabinet';
import {
  adherence,
  addDays,
  daysBetween,
  doseState,
  doseTimes,
  pickFefo,
  type DoseState,
} from './logic';
import type { SkipInput, TakeInput } from './schemas';
import {
  findTreatment,
  findTreatmentRow,
  listTreatments,
  scheduleOf,
  treatmentRowsOn,
} from './treatments';

/**
 * Doses: made day by day from each treatment's schedule, taken (and counted out of the stock,
 * first to expire first), skipped, snoozed, undone.
 */

const MAX_RANGE_DAYS = 62;

interface DoseRow {
  id: string;
  treatment_id: string;
  medicine_id: string;
  person_id: string;
  person_name: string;
  medicine_name: string;
  strength: string;
  form: string;
  unit: string;
  instructions: string[];
  due_on: string;
  due_time: string | null;
  status: 'due' | 'taken' | 'skipped';
  amount: number;
  taken_at: Date | null;
  skip_reason: string;
  snoozed_until: Date | null;
  shortfall: number;
}

const SELECT = `SELECT d.id, d.treatment_id, d.medicine_id, d.person_id, u.name AS person_name,
    m.name AS medicine_name, m.strength, m.form, m.unit, t.instructions, d.due_on::text, d.due_time, d.status,
    d.amount::float8 AS amount, d.taken_at, d.skip_reason, d.snoozed_until, d.shortfall::float8 AS shortfall
  FROM medication_doses d
  JOIN users u ON u.id = d.person_id
  JOIN medication_medicines m ON m.id = d.medicine_id
  JOIN medication_treatments t ON t.id = d.treatment_id`;

export const toDose = (row: DoseRow, now: Date) => ({
  id: row.id,
  treatmentId: row.treatment_id,
  medicineId: row.medicine_id,
  medicineName: row.medicine_name,
  strength: row.strength,
  form: row.form,
  unit: row.unit,
  instructions: row.instructions,
  personId: row.person_id,
  personName: row.person_name,
  dueOn: row.due_on,
  dueTime: row.due_time,
  asNeeded: row.due_time === null,
  amount: row.amount,
  status: row.status,
  state: doseState(
    { status: row.status, dueOn: row.due_on, dueTime: row.due_time, snoozedUntil: row.snoozed_until },
    now,
  ) as DoseState,
  takenAt: row.taken_at ? row.taken_at.toISOString() : null,
  skipReason: row.skip_reason,
  snoozedUntil: row.snoozed_until ? row.snoozed_until.toISOString() : null,
  shortfall: row.shortfall,
});
export type Dose = ReturnType<typeof toDose>;

/** Makes the doses the schedules say for a range of days (the ones that exist stay as they are). */
export async function ensureDoses(ctx: FoodCtx, from: string, to: string): Promise<void> {
  if (to < from) return;
  if (daysBetween(from, to) > MAX_RANGE_DAYS)
    throw new AppError(400, 'VALIDATION', 'Ask for at most two months at a time');
  const rows = await treatmentRowsOn(ctx, to);
  for (const row of rows) {
    const schedule = scheduleOf(row);
    // Nothing is made for days before the treatment was entered: it is not a missed dose.
    const first = localDate(row.created_at);
    for (let date = from > first ? from : first; date <= to; date = addDays(date, 1)) {
      for (const time of doseTimes(schedule, date)) {
        await ctx.db.query(
          `INSERT INTO medication_doses (id, household_id, treatment_id, medicine_id, person_id, due_on, due_time,
             status, amount, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'due', $8, $9)
           ON CONFLICT (treatment_id, due_on, due_time) WHERE due_time IS NOT NULL DO NOTHING`,
          [randomUUID(), ctx.actor.householdId, row.id, row.medicine_id, row.person_id, date, time, row.dose, ctx.now],
        );
      }
    }
  }
}

async function findDoseRow(ctx: FoodCtx, id: string): Promise<DoseRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That dose isn’t in your treatments');
  const { rows } = await ctx.db.query<DoseRow>(`${SELECT} WHERE d.id = $1 AND d.household_id = $2`, [
    id,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That dose isn’t in your treatments');
  return rows[0];
}

export async function findDose(ctx: FoodCtx, id: string) {
  return toDose(await findDoseRow(ctx, id), ctx.now);
}

/** A day's doses for the household (or one person), with the as-needed treatments to take from. */
export async function dayView(ctx: FoodCtx, date: string, person?: string) {
  await ensureDoses(ctx, date, date);
  const { rows } = await ctx.db.query<DoseRow>(
    `${SELECT} WHERE d.household_id = $1 AND d.due_on = $2::date AND ($3::uuid IS NULL OR d.person_id = $3)
      ORDER BY d.due_time NULLS LAST, d.taken_at, m.name`,
    [ctx.actor.householdId, date, person ?? null],
  );
  const doses = rows.map((row) => toDose(row, ctx.now));
  const treatments = await listTreatments(ctx);
  const asNeeded = treatments
    .filter((t) => t.kind === 'prn' && t.status === 'active' && (!person || t.personId === person))
    .map((t) => ({
      ...t,
      takenToday: doses.filter((d) => d.treatmentId === t.id && d.status === 'taken').length,
    }));
  return { date, doses, asNeeded };
}

/** The next dose still to take, for the home card: the earliest due, snoozed or upcoming today or tomorrow. */
export async function nextDose(ctx: FoodCtx, person?: string) {
  const today = todayOf(ctx);
  await ensureDoses(ctx, today, addDays(today, 1));
  const { rows } = await ctx.db.query<DoseRow>(
    `${SELECT} WHERE d.household_id = $1 AND d.status = 'due' AND d.due_time IS NOT NULL
        AND d.due_on BETWEEN $2::date AND $3::date AND ($4::uuid IS NULL OR d.person_id = $4)
      ORDER BY d.due_on, d.due_time`,
    [ctx.actor.householdId, today, addDays(today, 1), person ?? null],
  );
  const doses = rows.map((row) => toDose(row, ctx.now));
  const open = doses.filter((d) => d.state !== 'missed');
  return open[0] ?? null;
}

// ---------------------------------------------------------------- taking out of the stock

/** Counts an amount out of a medicine's packages, first to expire first. */
async function deduct(ctx: FoodCtx, medicineId: string, amount: number) {
  const today = todayOf(ctx);
  // Lock the medicine's packages so two taps at once can't count the same tablet twice.
  await ctx.db.query('SELECT id FROM medication_packages WHERE medicine_id = $1 FOR UPDATE', [medicineId]);
  const packages = (await listPackages(ctx, [medicineId])).filter((p) => p.status === 'ok');
  const { deductions, shortfall } = pickFefo(packages.map(asStock), amount, today);
  for (const d of deductions) {
    await ctx.db.query(
      `UPDATE medication_packages SET quantity = quantity - $2,
          status = CASE WHEN quantity - $2 <= 0 THEN 'finished' ELSE status END, updated_at = $3
        WHERE id = $1`,
      [d.id, d.amount, ctx.now],
    );
  }
  return { deductions, shortfall };
}

/** Puts back what a dose took (undo). A package that was finished by it is in use again. */
async function restore(ctx: FoodCtx, deductions: Array<{ id: string; amount: number }>) {
  for (const d of deductions) {
    await ctx.db.query(
      `UPDATE medication_packages SET quantity = quantity + $2,
          status = CASE WHEN status = 'finished' THEN 'ok' ELSE status END, updated_at = $3
        WHERE id = $1`,
      [d.id, d.amount, ctx.now],
    );
  }
}

export async function takeDose(ctx: FoodCtx, id: string, input: TakeInput = {}) {
  const row = await findDoseRow(ctx, id);
  if (row.status === 'taken') return { dose: toDose(row, ctx.now), already: true };
  const amount = input.amount ?? row.amount;
  await ctx.tx(async (tx) => {
    const { deductions, shortfall } = await deduct(tx, row.medicine_id, amount);
    await tx.db.query(
      `UPDATE medication_doses SET status = 'taken', amount = $2, taken_at = $3, deductions = $4::jsonb,
          shortfall = $5, skip_reason = '', snoozed_until = NULL WHERE id = $1`,
      [id, amount, input.at ? new Date(input.at) : tx.now, JSON.stringify(deductions), shortfall],
    );
  });
  return { dose: await findDose(ctx, id), already: false };
}

export async function skipDose(ctx: FoodCtx, id: string, input: SkipInput = {}) {
  const row = await findDoseRow(ctx, id);
  if (row.status === 'taken') throw new AppError(409, 'CONFLICT', 'That dose was already taken');
  await ctx.db.query(
    `UPDATE medication_doses SET status = 'skipped', skip_reason = $2, snoozed_until = NULL WHERE id = $1`,
    [id, input.reason ?? ''],
  );
  return { dose: await findDose(ctx, id) };
}

/** Asks again in 10 or 30 minutes (the reminder will go out again then). */
export async function snoozeDose(ctx: FoodCtx, id: string, minutes: 10 | 30 = 10) {
  const row = await findDoseRow(ctx, id);
  if (row.status !== 'due') throw new AppError(409, 'CONFLICT', 'That dose was already answered');
  await ctx.db.query(
    `UPDATE medication_doses SET snoozed_until = $2, notified_at = NULL, renotified_at = NULL WHERE id = $1`,
    [id, new Date(ctx.now.getTime() + minutes * 60_000)],
  );
  return { dose: await findDose(ctx, id) };
}

/** Takes it back: a taken dose returns to the stock, a skipped one is due again. */
export async function undoDose(ctx: FoodCtx, id: string) {
  const row = await findDoseRow(ctx, id);
  if (row.status === 'due') return { dose: toDose(row, ctx.now), removed: false };
  const { rows } = await ctx.db.query<{ deductions: Array<{ id: string; amount: number }> }>(
    'SELECT deductions FROM medication_doses WHERE id = $1',
    [id],
  );
  await ctx.tx(async (tx) => {
    await restore(tx, rows[0]?.deductions ?? []);
    if (row.due_time === null) {
      // An as-needed intake exists only because it was taken.
      await tx.db.query('DELETE FROM medication_doses WHERE id = $1', [id]);
    } else {
      await tx.db.query(
        `UPDATE medication_doses SET status = 'due', taken_at = NULL, skip_reason = '', deductions = '[]'::jsonb,
            shortfall = 0, snoozed_until = NULL, notified_at = NULL, renotified_at = NULL WHERE id = $1`,
        [id],
      );
    }
  });
  if (row.due_time === null) return { dose: toDose(row, ctx.now), removed: true };
  return { dose: await findDose(ctx, id), removed: false };
}

/** An as-needed intake right now (or at `at`), within the treatment's daily maximum. */
export async function takeAsNeeded(ctx: FoodCtx, treatmentId: string, input: TakeInput = {}) {
  const treatment = await findTreatment(ctx, treatmentId);
  if (treatment.kind !== 'prn')
    throw new AppError(400, 'VALIDATION', 'That treatment has a schedule: take its dose from Today');
  if (treatment.status !== 'active') throw new AppError(409, 'CONFLICT', 'That treatment has ended');
  const when = input.at ? new Date(input.at) : ctx.now;
  const day = localDate(when);
  if (treatment.maxPerDay && !input.override) {
    const { rows } = await ctx.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM medication_doses
        WHERE treatment_id = $1 AND due_on = $2::date AND status = 'taken'`,
      [treatmentId, day],
    );
    if ((rows[0]?.n ?? 0) >= treatment.maxPerDay)
      throw new AppError(409, 'CONFLICT', `Already ${treatment.maxPerDay} today: that is the daily maximum`);
  }
  const amount = input.amount ?? treatment.dose;
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    const { deductions, shortfall } = await deduct(tx, treatment.medicineId, amount);
    await tx.db.query(
      `INSERT INTO medication_doses (id, household_id, treatment_id, medicine_id, person_id, due_on, due_time,
         status, amount, taken_at, deductions, shortfall, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, 'taken', $7, $8, $9::jsonb, $10, $11)`,
      [
        id,
        ctx.actor.householdId,
        treatmentId,
        treatment.medicineId,
        treatment.personId,
        day,
        amount,
        when,
        JSON.stringify(deductions),
        shortfall,
        tx.now,
      ],
    );
  });
  return { dose: await findDose(ctx, id), already: false };
}

/** The dose a scheduled treatment wants taken now: the earliest one still open today. */
export async function openDoseOf(ctx: FoodCtx, treatmentId: string) {
  await findTreatmentRow(ctx, treatmentId);
  const today = todayOf(ctx);
  await ensureDoses(ctx, today, today);
  const { rows } = await ctx.db.query<DoseRow>(
    `${SELECT} WHERE d.treatment_id = $1 AND d.due_on = $2::date AND d.status = 'due' ORDER BY d.due_time`,
    [treatmentId, today],
  );
  const doses = rows.map((row) => toDose(row, ctx.now));
  return doses.find((d) => d.state !== 'missed') ?? doses[0] ?? null;
}

// ---------------------------------------------------------------- history

export async function intake(
  ctx: FoodCtx,
  query: { from?: string; to?: string; treatmentId?: string; person?: string },
) {
  const to = query.to ?? todayOf(ctx);
  const from = query.from ?? addDays(to, -29);
  await ensureDoses(ctx, from, to);
  const { rows } = await ctx.db.query<DoseRow>(
    `${SELECT} WHERE d.household_id = $1 AND d.due_on BETWEEN $2::date AND $3::date
        AND ($4::uuid IS NULL OR d.treatment_id = $4) AND ($5::uuid IS NULL OR d.person_id = $5)
      ORDER BY d.due_on DESC, d.due_time DESC NULLS FIRST, d.taken_at DESC`,
    [ctx.actor.householdId, from, to, query.treatmentId ?? null, query.person ?? null],
  );
  const doses = rows.map((row) => toDose(row, ctx.now));
  // A dose still ahead is not part of how well it went.
  const counted = doses.filter((d) => d.state !== 'due' && d.state !== 'snoozed');
  const perTreatment = new Map<string, DoseState[]>();
  for (const d of counted) {
    if (d.asNeeded) continue;
    perTreatment.set(d.treatmentId, [...(perTreatment.get(d.treatmentId) ?? []), d.state]);
  }
  return {
    from,
    to,
    doses,
    adherence: adherence(counted.filter((d) => !d.asNeeded).map((d) => d.state)),
    byTreatment: [...perTreatment].map(([treatmentId, states]) => ({
      treatmentId,
      adherence: adherence(states),
      taken: states.filter((s) => s === 'taken').length,
      skipped: states.filter((s) => s === 'skipped').length,
      missed: states.filter((s) => s === 'missed').length,
    })),
  };
}

/** What the doctor sees: the current treatments and the last 30 days of intake. */
export async function doctorExport(ctx: FoodCtx, person?: string) {
  const treatments = (await listTreatments(ctx)).filter(
    (t) => t.status !== 'finished' && (!person || t.personId === person),
  );
  const history = await intake(ctx, { person });
  return {
    generatedAt: ctx.now.toISOString(),
    treatments,
    history: history.doses.filter((d) => d.state === 'taken' || d.state === 'skipped' || d.state === 'missed'),
    adherence: history.adherence,
    byTreatment: history.byTreatment,
    from: history.from,
    to: history.to,
    note: 'Informativ; întreabă medicul sau farmacistul.',
  };
}
