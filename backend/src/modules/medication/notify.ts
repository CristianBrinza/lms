import type { AppDeps } from '../../context';
import type { Locale } from '../../lib/i18n';
import { foodCtx, type FoodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import type { PushMessage } from '../reminders/push';
import { sendToUser } from '../reminders/service';
import { listPackages } from './cabinet';
import { ensureDoses } from './doses';
import { MISSED_AFTER_MINUTES, dueAt, needsAlert } from './logic';

/**
 * Reminders for the medicine cabinet, on the phones that already get LMS's reminders (web push),
 * from the same one-minute clock (server.ts):
 *
 * - a dose: at its time, and once more 10 minutes later if nobody answered (with Taken and Skip
 *   buttons where the phone shows them); a snoozed dose asks again when the snooze ends;
 * - one digest a day (from 09:00) of the packages that crossed 90, 30 or 7 days before expiry, or
 *   expired. A package is told about each level once.
 */

const REPEAT_AFTER_MINUTES = 10;
const DIGEST_FROM = 9 * 60;
const DIGEST_UNTIL = 21 * 60;

interface Words {
  takeButton: string;
  skipButton: string;
  digestTitle: string;
  expired: string;
  today: string;
  inDays: (n: number) => string;
  unit: (unit: string) => string;
  again: string;
  instruction: Record<string, string>;
}

const en: Words = {
  takeButton: 'Taken',
  skipButton: 'Skip',
  digestTitle: 'Medicine cabinet: take a look',
  expired: 'expired',
  today: 'expires today',
  inDays: (n) => `${n} days left`,
  unit: (u) => ({ pcs: 'pcs', ml: 'ml', g: 'g', doses: 'doses' })[u] ?? u,
  again: 'Still waiting',
  instruction: {
    with_food: 'with food',
    before_food: 'before food',
    after_food: 'after food',
    empty_stomach: 'empty stomach',
    with_water: 'with water',
  },
};
const ro: Words = {
  takeButton: 'Luat',
  skipButton: 'Sar peste',
  digestTitle: 'Medicamente: de verificat',
  expired: 'a expirat',
  today: 'expiră azi',
  inDays: (n) => `mai sunt ${n} zile`,
  unit: (u) => ({ pcs: 'buc.', ml: 'ml', g: 'g', doses: 'doze' })[u] ?? u,
  again: 'Încă așteaptă',
  instruction: {
    with_food: 'cu mâncare',
    before_food: 'înainte de masă',
    after_food: 'după masă',
    empty_stomach: 'pe stomacul gol',
    with_water: 'cu apă',
  },
};
const ru: Words = {
  takeButton: 'Принято',
  skipButton: 'Пропустить',
  digestTitle: 'Лекарства: загляните в аптечку',
  expired: 'просрочено',
  today: 'срок истекает сегодня',
  inDays: (n) => `осталось ${n} дн.`,
  unit: (u) => ({ pcs: 'шт.', ml: 'мл', g: 'г', doses: 'доз' })[u] ?? u,
  again: 'Всё ещё ждёт',
  instruction: {
    with_food: 'во время еды',
    before_food: 'до еды',
    after_food: 'после еды',
    empty_stomach: 'натощак',
    with_water: 'с водой',
  },
};
const WORDS: Record<Locale, Words> = { en, ro, ru };
const wordsFor = (locale: Locale | null | undefined): Words => WORDS[locale ?? 'ro'] ?? ro;

/** The household's people, with the language each reads. */
async function people(deps: AppDeps, householdId: string) {
  const { rows } = await deps.db.query<{ id: string; locale: Locale | null }>(
    'SELECT id, locale FROM users WHERE household_id = $1 AND is_active',
    [householdId],
  );
  return rows;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const list = (names: string[], max = 4) =>
  names.length > max ? `${names.slice(0, max).join(', ')} +${names.length - max}` : names.join(', ');

async function doseReminders(deps: AppDeps, ctx: FoodCtx, now: Date): Promise<number> {
  const today = localDate(now);
  await ensureDoses(ctx, today, today);
  const { rows } = await deps.db.query<{
    id: string;
    person_id: string;
    due_time: string;
    amount: number;
    notified_at: Date | null;
    renotified_at: Date | null;
    medicine: string;
    strength: string;
    unit: string;
    instructions: string[];
    person_name: string;
  }>(
    `SELECT d.id, d.person_id, d.due_time, d.amount::float8 AS amount, d.notified_at, d.renotified_at,
            m.name AS medicine, m.strength, m.unit, t.instructions, u.name AS person_name
       FROM medication_doses d
       JOIN medication_medicines m ON m.id = d.medicine_id
       JOIN medication_treatments t ON t.id = d.treatment_id
       JOIN users u ON u.id = d.person_id
      WHERE d.household_id = $1 AND d.due_on = $2::date AND d.status = 'due' AND d.due_time IS NOT NULL
        AND (d.snoozed_until IS NULL OR d.snoozed_until <= $3)`,
    [ctx.actor.householdId, today, now],
  );
  const household = await people(deps, ctx.actor.householdId);
  let sent = 0;
  for (const dose of rows) {
    const due = dueAt(today, dose.due_time).getTime();
    // Past two hours it is a missed dose, not a reminder.
    if (now.getTime() < due || now.getTime() > due + MISSED_AFTER_MINUTES * 60_000) continue;
    const first = !dose.notified_at;
    const repeat =
      !!dose.notified_at &&
      !dose.renotified_at &&
      now.getTime() >= dose.notified_at.getTime() + REPEAT_AFTER_MINUTES * 60_000;
    if (!first && !repeat) continue;
    const { rowCount } = await deps.db.query(
      first
        ? 'UPDATE medication_doses SET notified_at = $2 WHERE id = $1 AND notified_at IS NULL'
        : 'UPDATE medication_doses SET renotified_at = $2 WHERE id = $1 AND renotified_at IS NULL',
      [dose.id, now],
    );
    if (!rowCount) continue;
    const message = (locale: Locale | null): PushMessage => {
      const words = wordsFor(locale);
      const hints = dose.instructions.map((i) => words.instruction[i]).filter(Boolean);
      return {
        title: `${dose.medicine}${dose.strength ? ` ${dose.strength}` : ''}`,
        body: [
          `${repeat ? `${words.again} · ` : ''}${dose.person_name}`,
          `${fmt(dose.amount)} ${words.unit(dose.unit)}`,
          dose.due_time,
          ...hints,
        ].join(' · '),
        url: `/medication?dose=${dose.id}`,
        tag: `medication-dose-${dose.id}`,
        actions: [
          { action: 'take', title: words.takeButton, post: `/api/medication/doses/${dose.id}/take` },
          { action: 'skip', title: words.skipButton, post: `/api/medication/doses/${dose.id}/skip` },
        ],
      };
    };
    // The person it is for; if they have no phone set up, the rest of the household hears of it.
    const person = household.find((p) => p.id === dose.person_id);
    let reached = await sendToUser(deps, dose.person_id, message(person?.locale ?? null));
    if (!reached)
      for (const other of household.filter((p) => p.id !== dose.person_id))
        reached += await sendToUser(deps, other.id, message(other.locale));
    sent += reached;
  }
  return sent;
}

async function expiryDigest(deps: AppDeps, ctx: FoodCtx, now: Date): Promise<number> {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < DIGEST_FROM || minutes > DIGEST_UNTIL) return 0;
  const packages = await listPackages(ctx);
  const alerts = packages.filter(
    (p) => p.status === 'ok' && needsAlert(p.alertLevel, p.alertedLevel),
  );
  if (!alerts.length) return 0;
  const key = `digest:${ctx.actor.householdId}:${localDate(now)}`;
  const { rowCount } = await deps.db.query(
    'INSERT INTO medication_notified (key, sent_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [key, now],
  );
  if (!rowCount) return 0;
  const { rows: names } = await deps.db.query<{ id: string; name: string; strength: string }>(
    'SELECT id, name, strength FROM medication_medicines WHERE household_id = $1',
    [ctx.actor.householdId],
  );
  const medicine = new Map(names.map((n) => [n.id, n]));
  const household = await people(deps, ctx.actor.householdId);
  let sent = 0;
  for (const person of household) {
    const words = wordsFor(person.locale);
    const parts = alerts.map((p) => {
      const m = medicine.get(p.medicineId);
      const label = [m?.name, m?.strength].filter(Boolean).join(' ');
      const days = p.expiry.days ?? 0;
      return `${label} (${days < 0 ? words.expired : days === 0 ? words.today : words.inDays(days)})`;
    });
    const expired = alerts.some((p) => p.expiry.state === 'expired');
    sent += await sendToUser(deps, person.id, {
      title: words.digestTitle,
      body: list(parts),
      url: `/medication?tab=cabinet&filter=${expired ? 'expired' : 'expiring'}`,
      tag: 'medication-expiry',
    });
  }
  if (sent > 0) {
    // Each package gets its own level (90, 30, 7 or 0), not the lowest.
    for (const level of [90, 30, 7, 0])
      await deps.db.query('UPDATE medication_packages SET alerted_level = $2 WHERE id = ANY ($1::uuid[])', [
        alerts.filter((p) => p.alertLevel === level).map((p) => p.id),
        level,
      ]);
  } else {
    // Nobody has reminders on yet: try again at the next look rather than lose the day.
    await deps.db.query('DELETE FROM medication_notified WHERE key = $1', [key]);
  }
  return sent;
}

/** Called every minute: sends the dose reminders and the expiry digest that are due. */
export async function runMedicationReminders(deps: AppDeps, now: Date = deps.now()): Promise<number> {
  if (!deps.push) return 0;
  const { rows } = await deps.db.query<{ id: string; currency: string; user_id: string }>(
    `SELECT h.id, h.currency, (SELECT u.id FROM users u WHERE u.household_id = h.id AND u.is_active ORDER BY u.created_at LIMIT 1) AS user_id
       FROM households h WHERE EXISTS (SELECT 1 FROM medication_medicines m WHERE m.household_id = h.id)`,
  );
  let sent = 0;
  for (const household of rows) {
    if (!household.user_id) continue;
    const ctx = foodCtx(deps, {
      householdId: household.id,
      userId: household.user_id,
      via: 'app',
      currency: household.currency,
    });
    ctx.now = now;
    try {
      sent += await doseReminders(deps, ctx, now);
      sent += await expiryDigest(deps, ctx, now);
    } catch (error) {
      console.error('[medication] reminders failed', error);
    }
  }
  return sent;
}
