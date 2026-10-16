import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Avatar, Button, TextField, toast } from '@/components/ui';
import { DeleteIcon, EditIcon } from '@/components/ui/icons';
import { formatNumber, messages } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { shrinkPhoto } from '@/lib/photo';
import type { Goal, ProfileValues } from '@/lib/profile';
import type { Activity, Gender } from '@/types/api';

/** 1st, 2nd, 3rd, 4th… 11th, 12th, 13th, 21st. */
const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/** 31 is stored for "the last day of the month": a shorter month counts its last day. */
const LAST_DAY = 31;
const onDayEn = (day: number) =>
  day === LAST_DAY ? 'on the last day of the month' : `on the ${ordinal(day)}`;
const onDayRo = (day: number) => (day === LAST_DAY ? 'în ultima zi a lunii' : `pe ${day}`);
const onDayRu = (day: number) => (day === LAST_DAY ? 'в последний день месяца' : `${day}-го`);

/** The copy for the current weight and the paydays; the profile's older copy is translated later. */
export const useProfileT = messages({
  en: {
    weight: 'Current weight, kg',
    measured: (days: number, date: string) =>
      days <= 0
        ? 'Measured today'
        : days === 1
          ? 'Measured yesterday'
          : days < 7
            ? `Measured ${days} days ago`
            : `Measured ${date}`,
    notMeasured: 'Not measured yet',
    willSave: 'Saved as today’s weight',
    weightRange: 'Between 20 and 400 kg',
    toGo: (kg: string) => `${kg} kg to go`,
    paydays: 'Paydays',
    paydaysLine: 'The family sees the countdown on Home. Only the days are kept, no amounts.',
    paydaysSummary: (salary: number | null, advance: number | null) =>
      salary !== null && advance !== null
        ? `Salary ${onDayEn(salary)}, advance ${onDayEn(advance)}`
        : salary !== null
          ? `Salary ${onDayEn(salary)}`
          : advance !== null
            ? `Advance ${onDayEn(advance)}`
            : 'Salary and advance days',
    salaryDay: 'Salary day',
    salaryHint: 'If the month is shorter, the last day counts.',
    advanceDay: 'Advance day',
    advanceHint: 'Leave empty if there’s no advance.',
    dayRange: 'A day from 1 to 31',
    lastDay: 'Last day of the month',
    save: 'Save',
    saved: 'Saved',
  },
  ro: {
    weight: 'Greutatea actuală, kg',
    measured: (days: number, date: string) =>
      days <= 0
        ? 'Măsurată azi'
        : days === 1
          ? 'Măsurată ieri'
          : days < 7
            ? `Măsurată acum ${days} zile`
            : `Măsurată pe ${date}`,
    notMeasured: 'Încă nu a fost măsurată',
    willSave: 'Se salvează ca greutatea de azi',
    weightRange: 'Între 20 și 400 kg',
    toGo: (kg: string) => `Mai sunt ${kg} kg`,
    paydays: 'Zile de plată',
    paydaysLine:
      'Familia vede numărătoarea inversă pe ecranul principal. Se păstrează doar zilele, fără sume.',
    paydaysSummary: (salary: number | null, advance: number | null) =>
      salary !== null && advance !== null
        ? `Salariul ${onDayRo(salary)}, avansul ${onDayRo(advance)}`
        : salary !== null
          ? `Salariul ${onDayRo(salary)}`
          : advance !== null
            ? `Avansul ${onDayRo(advance)}`
            : 'Ziua salariului și a avansului',
    salaryDay: 'Ziua salariului',
    salaryHint: 'Dacă luna e mai scurtă, contează ultima zi.',
    advanceDay: 'Ziua avansului',
    advanceHint: 'Lasă gol dacă nu ai avans.',
    dayRange: 'O zi de la 1 la 31',
    lastDay: 'Ultima zi a lunii',
    save: 'Salvează',
    saved: 'Salvat',
  },
  ru: {
    weight: 'Текущий вес, кг',
    measured: (days: number, date: string) =>
      days <= 0
        ? 'Измерен сегодня'
        : days === 1
          ? 'Измерен вчера'
          : days < 7
            ? `Измерен ${days} ${days < 5 ? 'дня' : 'дней'} назад`
            : `Измерен ${date}`,
    notMeasured: 'Ещё не измерялся',
    willSave: 'Сохранится как вес на сегодня',
    weightRange: 'От 20 до 400 кг',
    toGo: (kg: string) => `Осталось ${kg} кг`,
    paydays: 'Дни выплат',
    paydaysLine: 'Семья видит обратный отсчёт на главном экране. Хранятся только дни, без сумм.',
    paydaysSummary: (salary: number | null, advance: number | null) =>
      salary !== null && advance !== null
        ? `Зарплата ${onDayRu(salary)}, аванс ${onDayRu(advance)}`
        : salary !== null
          ? `Зарплата ${onDayRu(salary)}`
          : advance !== null
            ? `Аванс ${onDayRu(advance)}`
            : 'Дни зарплаты и аванса',
    salaryDay: 'День зарплаты',
    salaryHint: 'Если в месяце меньше дней, считается последний день.',
    advanceDay: 'День аванса',
    advanceHint: 'Оставьте пустым, если аванса нет.',
    dayRange: 'День от 1 до 31',
    lastDay: 'Последний день месяца',
    save: 'Сохранить',
    saved: 'Сохранено',
  },
});

// ── Current weight ──────────────────────────────────────────────────────────────────────────

/** The latest weight on the account, from any source. */
export interface LatestWeight {
  weightKg: number | null;
  /** YYYY-MM-DD */
  weightDay: string | null;
}

/** The current-weight field's state, made by useWeightField. */
export interface WeightField {
  text: string;
  onChange: (text: string) => void;
  latest: LatestWeight;
  /** The person typed a weight that differs from the latest one. */
  changed: boolean;
  error?: string;
}

const parseKg = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(n) ? n : null;
};
const tenth = (n: number) => Math.round(n * 10) / 10;

/** Whole days from a YYYY-MM-DD day to today, by the device's calendar. */
function daysSince(day: string): number {
  const then = new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
  );
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

/**
 * The current weight beside the goal: prefilled with the latest one, sent only when changed
 * (a new number is recorded as today's weight).
 *
 *   const weight = useWeightField(user);
 *   save: if (weight.check()) mutate({ ...profileInput(value), ...weight.input() })
 */
export function useWeightField(latest: LatestWeight) {
  const t = useProfileT();
  const [text, setText] = useState(() =>
    latest.weightKg === null ? '' : String(tenth(latest.weightKg)),
  );
  const [tried, setTried] = useState(false);
  const kg = parseKg(text);
  const changed =
    text.trim() !== '' &&
    (kg === null || latest.weightKg === null || tenth(kg) !== tenth(latest.weightKg));
  const problem = changed && (kg === null || kg < 20 || kg > 400) ? t.weightRange : undefined;
  const field: WeightField = {
    text,
    onChange: setText,
    latest,
    changed,
    error: tried ? problem : undefined,
  };
  return {
    field,
    /** False, showing why, when the typed weight can't be saved. */
    check: () => {
      setTried(true);
      return !problem;
    },
    /** `weightKg` only when the person typed a new weight. */
    input: (): { weightKg?: number } =>
      changed && kg !== null && !problem ? { weightKg: tenth(kg) } : {},
  };
}

const GENDER_LABEL: Record<Gender, string> = { female: 'Female', male: 'Male', other: 'Other' };
const GOALS: Array<[Goal, string]> = [
  ['lose', 'Lose weight'],
  ['keep', 'Keep my weight'],
  ['gain', 'Gain weight'],
];
const RATES = [0.25, 0.5, 0.75];
const ACTIVITY: Array<[Activity, string]> = [
  ['sedentary', 'Mostly sitting'],
  ['light', 'On my feet a bit'],
  ['moderate', 'On my feet a lot'],
  ['active', 'Physical work'],
  ['very', 'Hard physical work'],
];

const chipClass = (active: boolean) =>
  cx(
    'press h-11 rounded-full px-4 text-[0.9375rem] font-semibold transition-colors',
    active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-800 hover:bg-ink-100',
  );

/**
 * Gender, birth date, height, the goal with the current weight beside it, and a usual day: for
 * training plans and the energy numbers.
 */
export function ProfileFieldsForm({
  value,
  onChange,
  weight,
  errors = {},
}: {
  value: ProfileValues;
  onChange: (value: ProfileValues) => void;
  weight: WeightField;
  /** The API's per-field messages (fieldErrors). */
  errors?: Record<string, string>;
}) {
  const t = useProfileT();
  const chip = chipClass;
  const today = new Date().toISOString().slice(0, 10);
  const losingOrGaining = value.goal === 'lose' || value.goal === 'gain';

  const { latest } = weight;
  const weightHint = weight.changed
    ? t.willSave
    : latest.weightDay
      ? t.measured(daysSince(latest.weightDay), formatDate(`${latest.weightDay}T12:00:00`))
      : latest.weightKg === null
        ? t.notMeasured
        : undefined;

  // "6 kg to go": from the typed weight (or the latest) to the goal, in the goal's direction.
  const typed = parseKg(weight.text);
  const nowKg = typed !== null && typed >= 20 && typed <= 400 ? typed : latest.weightKg;
  const goalKg = parseKg(value.goalWeight);
  const gap =
    losingOrGaining && nowKg !== null && goalKg !== null
      ? tenth(value.goal === 'lose' ? nowKg - goalKg : goalKg - nowKg)
      : 0;
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Gender</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={value.gender === g}
              className={chip(value.gender === g)}
              onClick={() => onChange({ ...value, gender: value.gender === g ? null : g })}
            >
              {GENDER_LABEL[g]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Birth date"
          type="date"
          max={today}
          min="1900-01-01"
          value={value.birthDate}
          onChange={(e) => onChange({ ...value, birthDate: e.target.value })}
        />
        <TextField
          label="Height, cm"
          inputMode="numeric"
          placeholder="170"
          value={value.height}
          onChange={(e) => onChange({ ...value, height: e.target.value.replace(/[^\d.,]/g, '') })}
        />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Goal</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {GOALS.map(([g, label]) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={value.goal === g}
              className={chip(value.goal === g)}
              onClick={() =>
                onChange({
                  ...value,
                  goal: value.goal === g ? null : g,
                  goalRate: value.goalRate ?? (g === 'gain' ? 0.25 : 0.5),
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.weight}
          inputMode="decimal"
          autoComplete="off"
          placeholder="72"
          value={weight.text}
          onChange={(e) => weight.onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          hint={weightHint}
          error={weight.error ?? errors.weightKg}
        />
        {losingOrGaining ? (
          <TextField
            label="Goal weight, kg"
            inputMode="decimal"
            placeholder="70"
            value={value.goalWeight}
            onChange={(e) =>
              onChange({ ...value, goalWeight: e.target.value.replace(/[^\d.,]/g, '') })
            }
            hint={gap > 0 ? t.toGo(formatNumber(gap, { maximumFractionDigits: 1 })) : undefined}
            error={errors.goalWeight}
          />
        ) : null}
      </div>
      {losingOrGaining ? (
        <fieldset>
          <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Pace</legend>
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={value.goalRate === r}
                className={chip(value.goalRate === r)}
                onClick={() => onChange({ ...value, goalRate: r })}
              >
                {r} kg a week
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <fieldset>
        <legend className="mb-1 text-[0.8125rem] font-semibold text-ink-700">
          A usual day, without training
        </legend>
        <p className="mb-1.5 text-xs text-ink-500">
          Used when the phone doesn’t send active energy.
        </p>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {ACTIVITY.map(([a, label]) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={(value.activity ?? 'light') === a}
              className={chip((value.activity ?? 'light') === a)}
              onClick={() => onChange({ ...value, activity: a })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/**
 * The picture with "Change photo" and "Remove": a photo from the library or the camera, made
 * small on the device, sent as it is picked.
 */
export function PhotoPicker({
  person,
  onSave,
  busy,
}: {
  person: { id?: string; name: string; surname: string; avatarUrl?: string | null };
  onSave: (image: string | null) => Promise<unknown>;
  busy?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setWorking(true);
    try {
      await onSave(await shrinkPhoto(file));
      toast.success('Photo saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t save the photo');
    } finally {
      setWorking(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar person={person} size="xl" className="size-24 text-2xl ring-4" />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          size="sm"
          variant="soft"
          icon={EditIcon}
          loading={working || busy}
          onClick={() => input.current?.click()}
        >
          {person.avatarUrl ? 'Change photo' : 'Add a photo'}
        </Button>
        {person.avatarUrl ? (
          <Button
            size="sm"
            variant="ghost"
            icon={DeleteIcon}
            disabled={working || busy}
            onClick={() =>
              void onSave(null).then(
                () => toast.success('Photo removed'),
                () => toast.error('Couldn’t remove the photo'),
              )
            }
          >
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}

// ── Paydays ─────────────────────────────────────────────────────────────────────────────────

/** Days of the month (1–31), no amounts; null is none. */
export interface Paydays {
  salaryDay: number | null;
  advanceDay: number | null;
}

/** A day field: typed digits, or the "Last day of the month" choice (stored as 31). */
interface DayValue {
  text: string;
  last: boolean;
}

const dayValue = (day: number | null): DayValue =>
  day === LAST_DAY
    ? { text: '', last: true }
    : { text: day === null ? '' : String(day), last: false };

/** null when empty, undefined when it isn't a day of the month. */
function parseDay({ text, last }: DayValue): number | null | undefined {
  if (last) return LAST_DAY;
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
}

function DayField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint: string;
  value: DayValue;
  onChange: (value: DayValue) => void;
  error?: string;
}) {
  const t = useProfileT();
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <TextField
        label={label}
        inputMode="numeric"
        autoComplete="off"
        maxLength={value.last ? undefined : 2}
        value={value.last ? t.lastDay : value.text}
        disabled={value.last}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          // Typing 31 is the same choice as the chip, and shows as it.
          onChange(
            Number(digits) === LAST_DAY ? { text: '', last: true } : { text: digits, last: false },
          );
        }}
        hint={hint}
        error={error}
      />
      <button
        type="button"
        aria-pressed={value.last}
        className={cx(chipClass(value.last), 'self-start')}
        onClick={() => onChange({ text: '', last: !value.last })}
      >
        {t.lastDay}
      </button>
    </div>
  );
}

/**
 * The salary day and the optional advance day, for Home's countdown. Saves both at once (an
 * empty field clears). Used on the profile (your own) and by the admin (anyone's).
 */
export function PaydayForm<T>({
  person,
  save,
  onSaved,
  wide = false,
}: {
  person: Paydays;
  save: (input: Paydays) => Promise<T>;
  onSaved: (user: T) => void;
  /** A full-width button, for a sheet. */
  wide?: boolean;
}) {
  const t = useProfileT();
  const [salary, setSalary] = useState(() => dayValue(person.salaryDay));
  const [advance, setAdvance] = useState(() => dayValue(person.advanceDay));
  const [tried, setTried] = useState(false);
  const salaryDay = parseDay(salary);
  const advanceDay = parseDay(advance);
  const mutation = useMutation({
    mutationFn: () => save({ salaryDay: salaryDay ?? null, advanceDay: advanceDay ?? null }),
    onSuccess: (user) => {
      onSaved(user);
      toast.success(t.saved);
    },
  });
  const fields = fieldErrors(mutation.error);
  const changed = salaryDay !== person.salaryDay || advanceDay !== person.advanceDay;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (salaryDay === undefined || advanceDay === undefined) return;
    mutation.mutate();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <DayField
          label={t.salaryDay}
          hint={t.salaryHint}
          value={salary}
          onChange={setSalary}
          error={tried && salaryDay === undefined ? t.dayRange : fields.salaryDay}
        />
        <DayField
          label={t.advanceDay}
          hint={t.advanceHint}
          value={advance}
          onChange={setAdvance}
          error={tried && advanceDay === undefined ? t.dayRange : fields.advanceDay}
        />
      </div>
      {mutation.error && !fields.salaryDay && !fields.advanceDay ? (
        <p className="text-sm font-medium text-danger-600">{errorMessage(mutation.error)}</p>
      ) : null}
      <Button
        type="submit"
        size="md"
        fullWidth={wide}
        className={wide ? undefined : 'self-start'}
        loading={mutation.isPending}
        disabled={!changed}
      >
        {t.save}
      </Button>
    </form>
  );
}
