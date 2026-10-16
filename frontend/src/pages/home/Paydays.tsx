import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useUser } from '@/app/auth';
import { Avatar, Skeleton } from '@/components/ui';
import { CalendarIcon, ChevronRightIcon } from '@/components/ui/icons';
import { formatNumber, intlLocale, messages, plural } from '@/i18n';
import { cx } from '@/lib/cx';
import {
  calendarDaysUntil,
  countdown,
  cycleProgress,
  fetchPaydays,
  isToday,
  paydaysOf,
  paydaysQueryKey,
  tickDelay,
  type Payday,
  type PaydayKind,
  type PaydayPerson,
} from './paydays';

const useT = messages({
  en: {
    title: 'Paydays',
    kind: { salary: 'Salary', advance: 'Advance' } as Record<PaydayKind, string>,
    payday: 'Payday',
    today: 'Today',
    inDays: (days: number) =>
      days <= 1 ? (days ? 'tomorrow' : 'today') : plural(days, { one: '# day', other: '# days' }),
    days: (count: number) => plural(count, { one: 'day', other: 'days' }),
    hours: 'h',
    minutes: 'min',
    seconds: 's',
    addTitle: 'Add your salary day',
    addDetail: 'A countdown here, never the amount.',
    sayToday: (name: string, kind: string) => `${name}: ${kind} today`,
    sayTomorrow: (name: string, kind: string, date: string) => `${name}: ${kind} tomorrow, ${date}`,
    sayIn: (name: string, kind: string, count: number, date: string) =>
      `${name}: ${kind} in ${plural(count, { one: '# day', other: '# days' })}, ${date}`,
  },
  ro: {
    title: 'Zile de salariu',
    kind: { salary: 'Salariu', advance: 'Avans' },
    payday: 'Azi',
    today: 'Azi',
    inDays: (days: number) =>
      days <= 1
        ? days
          ? 'mâine'
          : 'azi'
        : plural(days, { one: '# zi', few: '# zile', other: '# de zile' }),
    days: (count: number) => plural(count, { one: 'zi', few: 'zile', other: 'de zile' }),
    hours: 'h',
    minutes: 'min',
    seconds: 's',
    addTitle: 'Adaugă ziua salariului',
    addDetail: 'Aici apare o numărătoare, niciodată suma.',
    sayToday: (name: string, kind: string) => `${name}: ${kind} azi`,
    sayTomorrow: (name: string, kind: string, date: string) => `${name}: ${kind} mâine, ${date}`,
    sayIn: (name: string, kind: string, count: number, date: string) =>
      `${name}: ${kind} peste ${plural(count, { one: '# zi', few: '# zile', other: '# de zile' })}, ${date}`,
  },
  ru: {
    title: 'Дни зарплаты',
    kind: { salary: 'Зарплата', advance: 'Аванс' },
    payday: 'Сегодня',
    today: 'Сегодня',
    inDays: (days: number) =>
      days <= 1
        ? days
          ? 'завтра'
          : 'сегодня'
        : plural(days, { one: '# день', few: '# дня', many: '# дней', other: '# дня' }),
    days: (count: number) =>
      plural(count, { one: 'день', few: 'дня', many: 'дней', other: 'дня' }),
    hours: 'ч',
    minutes: 'мин',
    seconds: 'с',
    addTitle: 'Добавьте день зарплаты',
    addDetail: 'Здесь только обратный отсчёт, никогда не сумма.',
    sayToday: (name: string, kind: string) => `${name}: ${kind} сегодня`,
    sayTomorrow: (name: string, kind: string, date: string) =>
      `${name}: ${kind} завтра, ${date}`,
    sayIn: (name: string, kind: string, count: number, date: string) =>
      `${name}: ${kind} через ${plural(count, { one: '# день', few: '# дня', many: '# дней', other: '# дня' })}, ${date}`,
  },
});

type T = ReturnType<typeof useT>;

/** Date formats per language, made on first use: "Sat 31 Oct", "15 Nov", "Saturday 31 October". */
const formats = new Map<string, Record<'short' | 'day' | 'spoken', Intl.DateTimeFormat>>();
function dates() {
  const tag = intlLocale();
  let made = formats.get(tag);
  if (!made) {
    made = {
      short: new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short' }),
      day: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }),
      spoken: new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }),
    };
    formats.set(tag, made);
  }
  return made;
}

/** The deal-in delay, matching the Shopping row and the area tiles. */
const dealDelay = (index: number) => 80 + index * 70;

/** One person: a full row; two: side by side; three: three across; four: two by two; then threes. */
function columns(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2 || count === 4) return 'grid-cols-2';
  return 'grid-cols-3';
}

/**
 * Home's paydays, leading the areas grid: a row per person as tall as Shopping's, with a ring
 * round the face that fills as payday nears and a live countdown. Amounts never appear.
 * Renders its own full-width grid item (or nothing).
 */
export function Paydays() {
  const t = useT();
  const user = useUser();
  const query = useQuery({
    queryKey: paydaysQueryKey,
    queryFn: ({ signal }) => fetchPaydays(signal),
    staleTime: 60_000,
  });

  if (query.isPending) {
    return (
      <li className="col-span-full" aria-hidden="true">
        <Skeleton className="h-16 rounded-[1.25rem]" />
      </li>
    );
  }
  if (query.isError) return null;

  const people = query.data.people.filter((person) => paydaysOf(person, new Date()).length > 0);
  return (
    <li className="col-span-full">
      <h2 className="sr-only">{t.title}</h2>
      {people.length ? <PaydayRows people={people} meId={user.id} t={t} /> : <AddRow t={t} />}
    </li>
  );
}

/** The rows, on one clock: a single timer re-renders them all, paused while the tab is hidden. */
function PaydayRows({ people, meId, t }: { people: PaydayPerson[]; meId: string; t: T }) {
  const [now, setNow] = useState(() => new Date());
  // The rings fill in once the rows have painted empty.
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      const current = new Date();
      const upcoming = people.flatMap((person) => paydaysOf(person, current).map((p) => p.date));
      timer = window.setTimeout(tick, tickDelay(upcoming, current));
    };
    const tick = () => {
      setNow(new Date());
      schedule();
    };
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') tick();
    };
    if (document.visibilityState === 'visible') schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [people]);

  return (
    <ul className={cx('grid gap-3 lg:gap-4', columns(people.length))} aria-label={t.title}>
      {people.map((person, index) => (
        <li key={person.id} className="@container min-w-0">
          <PaydayRow
            person={person}
            mine={person.id === meId}
            now={now}
            index={index}
            grown={grown}
            t={t}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * One person, as tall as the Shopping row: the face in a ring that fills over the pay cycle, what
 * comes next and when, and the countdown on the right. Its width decides the detail (container
 * queries): from 15rem the name and the date show; from 24rem the later payday too.
 */
function PaydayRow({
  person,
  mine,
  now,
  index,
  grown,
  t,
}: {
  person: PaydayPerson;
  mine: boolean;
  now: Date;
  index: number;
  grown: boolean;
  t: T;
}) {
  const [first, second] = paydaysOf(person, now) as [Payday, Payday | undefined];
  const today = isToday(first, now);
  const other = second && second.date.getTime() !== first.date.getTime() ? second : undefined;
  const progress = today ? 1 : cycleProgress(first, now);
  const spoken = [first, other]
    .filter((payday): payday is Payday => Boolean(payday))
    .map((payday) => say(person.name, payday, now, t))
    .join('. ');

  const classes = cx(
    'flex h-16 items-center gap-1.5 rounded-[1.25rem] py-2.5 pl-2 pr-2 text-ink-900 shadow-[var(--shadow-card)] @min-[15rem]:gap-3 @min-[15rem]:pl-2.5 @min-[15rem]:pr-3',
    'animate-deal',
    today ? 'bg-mint-200' : 'bg-white',
    mine &&
      'press group/tile transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]',
  );
  const muted = today ? 'text-mint-800' : 'text-ink-600';

  const body = (
    <>
      <Ring progress={grown ? progress : 0} delay={dealDelay(index) + 200} today={today}>
        <Avatar person={person} size="sm" className="scale-[0.89] @min-[15rem]:scale-100" />
      </Ring>

      <span aria-hidden="true" className="min-w-0 flex-1">
        <span className="hidden truncate text-[0.9375rem] font-bold leading-tight @min-[15rem]:block">
          {person.name}
        </span>
        <span
          className={cx(
            'block truncate text-[0.8125rem] font-semibold leading-tight @min-[15rem]:mt-0.5 @min-[15rem]:font-medium',
            muted,
          )}
        >
          <span className="text-ink-900 @min-[15rem]:text-inherit">{t.kind[first.kind]}</span>
          {/* With a second payday beside it, the countdowns say enough: the date makes room. */}
          <span className={cx('hidden', !other && '@min-[15rem]:inline', other && '@min-[26rem]:inline')}>
            {' · '}
            {today ? t.today : dates().short.format(first.date)}
          </span>
        </span>
        {/* Narrow rows: the countdown sits under the kind instead of at the right. */}
        <span className="mt-0.5 block @min-[15rem]:hidden">
          <Count payday={first} now={now} t={t} />
        </span>
      </span>

      {/* The payday after the next one, faint: salary and advance take turns here. */}
      {other ? (
        <Later
          payday={other}
          now={now}
          grown={grown}
          delay={dealDelay(index) + 320}
          today={today}
          t={t}
        />
      ) : null}

      <span aria-hidden="true" className="hidden shrink-0 text-right @min-[15rem]:block">
        <Count payday={first} now={now} t={t} />
      </span>

      {mine ? (
        <ChevronRightIcon
          aria-hidden="true"
          fontSize="inherit"
          className={cx(
            '-ml-1 hidden shrink-0 text-[1.25rem] transition-transform duration-200 group-hover/tile:translate-x-0.5',
            other ? '@min-[26rem]:block' : '@min-[15rem]:block',
            muted,
          )}
        />
      ) : null}

      <span className="sr-only">{spoken}</span>
    </>
  );

  const style = { animationDelay: `${dealDelay(index)}ms` };
  return mine ? (
    <Link to="/profile" viewTransition className={classes} style={style}>
      {body}
    </Link>
  ) : (
    <div className={classes} style={style}>
      {body}
    </div>
  );
}

/** The face inside a ring that fills clockwise from the last payday to the next. */
function Ring({
  progress,
  delay,
  today,
  children,
}: {
  progress: number;
  delay: number;
  today: boolean;
  children: ReactNode;
}) {
  const size = 44;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <span
      aria-hidden="true"
      className="relative grid size-10 shrink-0 place-items-center @min-[15rem]:size-11"
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={today ? 'stroke-white/70' : 'stroke-lav-100'}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - progress)}
          className={cx(
            'transition-[stroke-dashoffset] duration-[900ms] ease-(--ease-out) motion-reduce:transition-none',
            today ? 'stroke-mint-800' : 'stroke-lav-600',
          )}
          style={{ transitionDelay: `${delay}ms` }}
        />
      </svg>
      {children}
    </span>
  );
}

/**
 * The other payday, small and faint beside the main one: its kind, the days to it, and under the
 * days a straight bar as wide as them, filling over its own cycle in the ring's colour.
 */
function Later({
  payday,
  now,
  grown,
  delay,
  today,
  t,
}: {
  payday: Payday;
  now: Date;
  grown: boolean;
  delay: number;
  today: boolean;
  t: T;
}) {
  const progress = cycleProgress(payday, now);
  return (
    <span
      aria-hidden="true"
      className="flex min-w-0 shrink-0 flex-col items-start text-[0.625rem] font-semibold leading-[1.2] @min-[15rem]:text-[0.6875rem]"
    >
      <span className="max-w-full truncate text-ink-900/50">{t.kind[payday.kind]}</span>
      <span className="inline-flex max-w-full flex-col">
        <span className="truncate whitespace-nowrap text-ink-900/50 tabular-nums">
          {t.inDays(calendarDaysUntil(payday.date, now))}
        </span>
        <span
          className={cx(
            'mt-1 block h-[3px] w-full overflow-hidden rounded-pill',
            today ? 'bg-white/70' : 'bg-lav-100',
          )}
        >
          <span
            className={cx(
              'block h-full rounded-pill transition-[width] duration-[900ms] ease-(--ease-out) motion-reduce:transition-none',
              today ? 'bg-mint-800' : 'bg-lav-600',
            )}
            style={{ width: `${(grown ? progress : 0) * 100}%`, transitionDelay: `${delay}ms` }}
          />
        </span>
      </span>
    </span>
  );
}

/** "14 days", "27 h 05 min", "4 min 09 s" or "Today": numbers large, units small. */
function Count({ payday, now, t }: { payday: Payday; now: Date; t: T }) {
  const left = countdown(payday.date, now);
  const pad = (value: number) => formatNumber(value, { minimumIntegerDigits: 2 });
  const parts: Array<[string, string]> =
    left.unit === 'today'
      ? []
      : left.unit === 'days'
        ? [[formatNumber(left.days), t.days(left.days)]]
        : left.unit === 'hours'
          ? [
              [formatNumber(left.hours), t.hours],
              [pad(left.minutes), t.minutes],
            ]
          : [
              [formatNumber(left.minutes), t.minutes],
              [pad(left.seconds), t.seconds],
            ];
  if (!parts.length)
    return <span className="text-[1.125rem] font-bold leading-none">{t.payday}</span>;
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-bold leading-none tabular-nums">
      {parts.map(([value, unit]) => (
        <span key={unit}>
          <span className="text-[1.0625rem] tracking-[-0.03em] @min-[15rem]:text-[1.375rem]">
            {value}
          </span>
          <span className="ml-0.5 text-xs font-semibold">{unit}</span>
        </span>
      ))}
    </span>
  );
}

/** The sentence a screen reader hears, by calendar day so it doesn't change every second. */
function say(name: string, payday: Payday, now: Date, t: T): string {
  const kind = t.kind[payday.kind];
  const days = calendarDaysUntil(payday.date, now);
  const date = dates().spoken.format(payday.date);
  if (days <= 0) return t.sayToday(name, kind);
  if (days === 1) return t.sayTomorrow(name, kind, date);
  return t.sayIn(name, kind, days, date);
}

/** Nobody has a day yet: one row like Shopping, to the profile where the day is set. */
function AddRow({ t }: { t: T }) {
  return (
    <Link
      to="/profile"
      viewTransition
      style={{ animationDelay: `${dealDelay(0)}ms` }}
      className={cx(
        'press group/tile flex min-h-16 items-center gap-3 rounded-[1.25rem] bg-white py-2.5 pl-2.5 pr-3 text-ink-900 shadow-[var(--shadow-card)]',
        'animate-deal transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]',
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-[0.875rem] bg-mint-200 text-[1.4rem]"
      >
        <CalendarIcon fontSize="inherit" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-bold leading-tight">{t.addTitle}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] font-medium text-ink-600">
          {t.addDetail}
        </span>
      </span>
      <ChevronRightIcon
        fontSize="inherit"
        className="shrink-0 text-[1.4rem] text-ink-600 transition-transform duration-200 group-hover/tile:translate-x-0.5"
      />
    </Link>
  );
}
