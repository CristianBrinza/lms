import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { isUuid } from '../users';
import {
  alertLevel,
  effectiveExpiry,
  expiryStatus,
  lastDayOfMonth,
  usablePackages,
  type ExpiryState,
} from './logic';
import { unitFor, type MedicineInput, type MedicinePatch, type PackageInput, type PackagePatch } from './schemas';

/** The medicine cabinet: medicines and their packages (stock lots), the household's. */

export const photoUrl = (id: string, size: 'full' | 'thumb') =>
  `/api/medication/photos/${id}/${size}`;

export const todayOf = (ctx: FoodCtx) => localDate(ctx.now);

interface MedicineRow {
  id: string;
  owner_id: string | null;
  owner_name: string | null;
  name: string;
  substance: string;
  strength: string;
  form: MedicineInput['form'] & string;
  unit: 'pcs' | 'ml' | 'g' | 'doses';
  rx: boolean;
  color: string;
  shape: string;
  notes: string;
  cover_id: string | null;
  photos: number;
  created_at: Date;
  updated_at: Date;
}

const MEDICINE_SELECT = `SELECT m.id, m.owner_id, u.name AS owner_name, m.name, m.substance, m.strength, m.form,
    m.unit, m.rx, m.color, m.shape, m.notes, m.created_at, m.updated_at, cover.id AS cover_id,
    coalesce(pc.photos, 0) AS photos
  FROM medication_medicines m
  LEFT JOIN users u ON u.id = m.owner_id
  LEFT JOIN LATERAL (
    SELECT id FROM medication_photos WHERE medicine_id = m.id ORDER BY position, created_at LIMIT 1
  ) cover ON true
  LEFT JOIN LATERAL (SELECT count(*)::int AS photos FROM medication_photos WHERE medicine_id = m.id) pc ON true`;

export const toMedicine = (row: MedicineRow) => ({
  id: row.id,
  name: row.name,
  substance: row.substance,
  strength: row.strength,
  form: row.form,
  unit: row.unit,
  rx: row.rx,
  color: row.color,
  shape: row.shape,
  notes: row.notes,
  ownerId: row.owner_id,
  ownerName: row.owner_name,
  cover: row.cover_id
    ? { id: row.cover_id, thumb: photoUrl(row.cover_id, 'thumb'), full: photoUrl(row.cover_id, 'full') }
    : null,
  photos: row.photos,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export type Medicine = ReturnType<typeof toMedicine>;

export async function listMedicines(ctx: FoodCtx): Promise<Medicine[]> {
  const { rows } = await ctx.db.query<MedicineRow>(
    `${MEDICINE_SELECT} WHERE m.household_id = $1 ORDER BY lower(m.name), m.strength`,
    [ctx.actor.householdId],
  );
  return rows.map(toMedicine);
}

export async function findMedicine(ctx: FoodCtx, id: string): Promise<Medicine> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That medicine isn’t in your cabinet');
  const { rows } = await ctx.db.query<MedicineRow>(
    `${MEDICINE_SELECT} WHERE m.id = $1 AND m.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That medicine isn’t in your cabinet');
  return toMedicine(rows[0]);
}

async function checkOwner(ctx: FoodCtx, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const { rows } = await ctx.db.query('SELECT 1 FROM users WHERE id = $1 AND household_id = $2', [
    ownerId,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(400, 'VALIDATION', 'No one at home by that id');
}

export async function addMedicine(ctx: FoodCtx, input: MedicineInput) {
  await checkOwner(ctx, input.ownerId);
  const id = randomUUID();
  const form = input.form ?? 'tablet';
  await ctx.db.query(
    `INSERT INTO medication_medicines (id, household_id, owner_id, name, substance, strength, form, unit,
       rx, color, shape, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
    [
      id,
      ctx.actor.householdId,
      input.ownerId ?? null,
      input.name,
      input.substance ?? '',
      input.strength ?? '',
      form,
      input.unit ?? unitFor(form),
      input.rx ?? false,
      input.color ?? '',
      input.shape ?? '',
      input.notes ?? '',
      ctx.now,
    ],
  );
  return { medicine: await findMedicine(ctx, id) };
}

export async function updateMedicine(ctx: FoodCtx, id: string, patch: MedicinePatch) {
  await findMedicine(ctx, id);
  await checkOwner(ctx, patch.ownerId);
  const columns: Record<string, string> = {
    name: 'name',
    substance: 'substance',
    strength: 'strength',
    form: 'form',
    unit: 'unit',
    rx: 'rx',
    color: 'color',
    shape: 'shape',
    notes: 'notes',
    ownerId: 'owner_id',
  };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(columns)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  values.push(ctx.now);
  await ctx.db.query(
    `UPDATE medication_medicines SET ${sets.join(', ')}${sets.length ? ',' : ''} updated_at = $${values.length} WHERE id = $1`,
    values,
  );
  return { medicine: await findMedicine(ctx, id) };
}

export async function removeMedicine(ctx: FoodCtx, id: string) {
  await findMedicine(ctx, id);
  await ctx.db.query('DELETE FROM medication_medicines WHERE id = $1', [id]);
}

// ---------------------------------------------------------------- packages

interface PackageRow {
  id: string;
  medicine_id: string;
  kind: 'box' | 'blister' | 'bottle' | 'tube';
  quantity: number;
  original: number;
  expires_on: string | null;
  expiry_month_only: boolean;
  batch: string;
  opened_on: string | null;
  use_within_days: number | null;
  place: string;
  status: 'ok' | 'finished' | 'discarded';
  alerted_level: number | null;
  created_at: Date;
}

const PACKAGE_COLUMNS = `p.id, p.medicine_id, p.kind, p.quantity::float8 AS quantity, p.original::float8 AS original,
  p.expires_on::text, p.expiry_month_only, p.batch, p.opened_on::text, p.use_within_days, p.place, p.status,
  p.alerted_level, p.created_at`;

export type PackageStatus = 'ok' | 'expired' | 'finished' | 'discarded';

export const toPackage = (row: PackageRow, today: string) => {
  const effective = effectiveExpiry({
    expiresOn: row.expires_on,
    openedOn: row.opened_on,
    useWithinDays: row.use_within_days,
  });
  const expiry = expiryStatus(effective, today);
  const status: PackageStatus =
    row.status === 'ok' && expiry.state === 'expired' ? 'expired' : row.status;
  return {
    id: row.id,
    medicineId: row.medicine_id,
    kind: row.kind,
    quantity: row.quantity,
    original: row.original,
    expiresOn: row.expires_on,
    monthOnly: row.expiry_month_only,
    effectiveExpiry: effective,
    batch: row.batch,
    openedOn: row.opened_on,
    useWithinDays: row.use_within_days,
    place: row.place,
    status,
    expiry: row.status === 'ok' ? expiry : { state: 'none' as ExpiryState, days: null },
    alertLevel: row.status === 'ok' ? alertLevel(expiry.days) : null,
    alertedLevel: row.alerted_level,
    createdAt: row.created_at.toISOString(),
  };
};
export type Package = ReturnType<typeof toPackage>;

/** A package's stock, as the rules of first-to-expire-first-out see it. */
export const asStock = (p: Package) => ({
  id: p.id,
  quantity: p.quantity,
  effectiveExpiry: p.effectiveExpiry,
  openedOn: p.openedOn,
  createdAt: p.createdAt,
});

/** Packages of the household (or of some medicines), the ones in use first. */
export async function listPackages(ctx: FoodCtx, medicineIds?: string[]): Promise<Package[]> {
  const today = todayOf(ctx);
  const { rows } = await ctx.db.query<PackageRow>(
    `SELECT ${PACKAGE_COLUMNS} FROM medication_packages p
      WHERE p.household_id = $1 AND ($2::uuid[] IS NULL OR p.medicine_id = ANY ($2::uuid[]))
      ORDER BY (p.status <> 'ok'), p.expires_on NULLS LAST, p.created_at`,
    [ctx.actor.householdId, medicineIds ?? null],
  );
  return rows.map((row) => toPackage(row, today));
}

export async function findPackage(ctx: FoodCtx, id: string): Promise<Package> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That package isn’t in your cabinet');
  const { rows } = await ctx.db.query<PackageRow>(
    `SELECT ${PACKAGE_COLUMNS} FROM medication_packages p WHERE p.id = $1 AND p.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That package isn’t in your cabinet');
  return toPackage(rows[0], todayOf(ctx));
}

/** A printed month ("2027-03") is its last day, kept with a flag that only the month was printed. */
function expiryParts(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return { date: null, monthOnly: false };
  return value.length === 7
    ? { date: lastDayOfMonth(value), monthOnly: true }
    : { date: value, monthOnly: false };
}

export async function addPackage(ctx: FoodCtx, medicineId: string, input: PackageInput) {
  await findMedicine(ctx, medicineId);
  const expiry = expiryParts(input.expiresOn);
  const id = randomUUID();
  await ctx.db.query(
    `INSERT INTO medication_packages (id, household_id, medicine_id, kind, quantity, original, expires_on,
       expiry_month_only, batch, opened_on, use_within_days, place, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
    [
      id,
      ctx.actor.householdId,
      medicineId,
      input.kind ?? 'box',
      input.quantity,
      input.original ?? input.quantity,
      expiry?.date ?? null,
      expiry?.monthOnly ?? false,
      input.batch ?? '',
      input.openedOn ?? null,
      input.useWithinDays ?? null,
      input.place ?? '',
      input.quantity > 0 ? 'ok' : 'finished',
      ctx.now,
    ],
  );
  return { package: await findPackage(ctx, id) };
}

export async function updatePackage(ctx: FoodCtx, id: string, patch: PackagePatch) {
  const before = await findPackage(ctx, id);
  const sets: string[] = [];
  const values: unknown[] = [id];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (patch.kind !== undefined) set('kind', patch.kind);
  if (patch.quantity !== undefined) {
    set('quantity', patch.quantity);
    // Refilling a finished package brings it back; counting it to nothing finishes it.
    if (patch.status === undefined && before.status !== 'discarded')
      set('status', patch.quantity > 0 ? 'ok' : 'finished');
  }
  if (patch.original !== undefined) set('original', patch.original);
  const expiry = expiryParts(patch.expiresOn);
  if (expiry) {
    set('expires_on', expiry.date);
    set('expiry_month_only', expiry.monthOnly);
    // A new date is news again.
    set('alerted_level', null);
  }
  if (patch.batch !== undefined) set('batch', patch.batch);
  if (patch.openedOn !== undefined) set('opened_on', patch.openedOn);
  if (patch.useWithinDays !== undefined) set('use_within_days', patch.useWithinDays);
  if (patch.place !== undefined) set('place', patch.place);
  if (patch.status !== undefined) set('status', patch.status);
  set('updated_at', ctx.now);
  await ctx.db.query(`UPDATE medication_packages SET ${sets.join(', ')} WHERE id = $1`, values);
  return { package: await findPackage(ctx, id) };
}

export async function removePackage(ctx: FoodCtx, id: string) {
  await findPackage(ctx, id);
  await ctx.db.query('DELETE FROM medication_packages WHERE id = $1', [id]);
}

/** "Aruncat": the package is thrown away and stops counting as stock. */
export const discardPackage = (ctx: FoodCtx, id: string) =>
  updatePackage(ctx, id, { status: 'discarded' });

/** What can be taken now from a medicine's packages, in its unit. */
export function availableOf(packages: Package[], today: string): number {
  const stock = usablePackages(
    packages.filter((p) => p.status === 'ok').map(asStock),
    today,
  );
  return Math.round(stock.reduce((sum, p) => sum + p.quantity, 0) * 1000) / 1000;
}

/** The household's own places so far: the ones its packages use. */
export async function placeNames(ctx: FoodCtx): Promise<string[]> {
  const { rows } = await ctx.db.query<{ place: string }>(
    `SELECT DISTINCT place FROM medication_packages
      WHERE household_id = $1 AND place <> '' AND status = 'ok' ORDER BY place`,
    [ctx.actor.householdId],
  );
  return rows.map((r) => r.place);
}
