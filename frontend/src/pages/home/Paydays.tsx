import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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
    days: (count: number) => plural(count, { one: 'day', other: 'days' }),
    hours: 'h',
    minutes: 'min',
    seconds: 's',
    addTitle: 'Add your salary day',
    addDetail: 'Only the day shows here, never the amount.',
    sayToday: (kind: string) => `${kind} today`,
    sayTomorrow: (kind: string, date: string) => `${kind} tomorrow, ${date}`,
    sayIn: (kind: string, count: number, date: string) =>
      `${kind} in ${plural(count, { one: '# day', other: '# days' })}, ${date}`,
  },
  ro: {
    title: 'Zile de salariu',
    kind: { salary: 'Salariu', advance: 'Avans' },
    payday: 'Zi de plată',
    today: 'Azi',
    days: (count: number) => plural(count, { one: 'zi', few: 'zile', other: 'de zile' }),
    hours: 'h',
    minutes: 'min',
    seconds: 's',
    addTitle: 'Adaugă ziua salariului',
    addDetail: 'Aici apare doar ziua, niciodată suma.',
    sayToday: (kind: string) => `${kind} azi`,
    sayTomorrow: (kind: string, date: string) => `${kind} mâine, ${date}`,
    sayIn: (kind: string, count: number, date: string) =>
      `${kind} peste ${plural(count, { one: '# zi', few: '# zile', other: '# de zile' })}, ${date}`,
  },
  ru: {
    title: 'Дни зарплаты',
    kind: { salary: 'Зарплата', advance: 'Аванс' },
    payday: 'День выплаты',
    today: 'Сегодня',
    days: (count: number) => plural(count, { one: 'день', few: 'дня', many: 'дней', other: 'дня' }),
    hours: 'ч',
    minutes: 'мин',
    seconds: 'с',
    addTitle: 'Добавьте день зарплаты',
    addDetail: 'Здесь виден только день, никогда не сумма.',
    sayToday: (kind: string) => `${kind} сегодня`,
    sayTomorrow: (kind: string, date: string) => `${kind} завтра, ${date}`,
    sayIn: (kind: string, count: number, date: string) =>
      `${kind} через ${plural(count, { one: '# день', few: '# дня', many: '# дней', other: '# дня' })}, ${date}`,
  },
});

type T = ReturnType<typeof useT>;

/** Date formats per language, made on first use: "Fri 31 Oct", "31 Oct", "Friday 31 October". */
const formats = new Map<string, Record<'headline' | 'other' | 'spoken', Intl.DateTimeFormat>>();
function dates() {
  const tag = intlLocale();
  let made = formats.get(tag);
  if (!made) {
    made = {
      headline: new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short' }),
      other: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }),
      spoken: new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }),
    };
    formats.set(tag, made);
  }
  return made;
}

/** The deal-in delay, matching the Shopping row and the area tiles. */
const dealDelay = (index: number) => 80 + index * 70;

/** One person to two people a row, three to three, four as two by two, then rows of three. */
function columns(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2 || count === 4) return 'grid-cols-2';
  return 'grid-cols-3';
}

/**
 * Home's paydays: a card per person with a live countdown to their next salary or advance day,
 * between the greeting and the areas. Amounts never appear, only when money comes next.
 */
export function Paydays() {
  const t = useT();
  const user = useUser();
  const query = useQuery({
    queryKey: paydaysQueryKey,
    queryFn: ({ signal }) => fetchPaydays(signal),
    staleTime: 5 * 60_000,
  });

  if (query.isPending) {
    return (
      <div className="mt-7" aria-hidden="true">
        <Skeleton className="h-16 rounded-[1.25rem]" />
      </div>
    );
  }
  if (query.isError) return null;

  const people = query.data.people.filter((person) => paydaysOf(person, new Date()).length > 0);

  return (
    <section aria-labelledby="paydays-title" className="mt-7">
      <h2 id="paydays-title" className="sr-only">
        {t.title}
      </h2>
      {people.length ? <PaydayGrid people={people} meId={user.id} t={t} /> : <AddRow t={t} />}
    </section>
  );
}

/** The cards, on one clock: a single timer re-renders the block, paused while the tab is hidden. */
function PaydayGrid({ people, meId, t }: { people: PaydayPerson[]; meId: string; t: T }) {
  const [now, setNow] = useState(() => new Date());
  // The cycle bars grow in once the cards have painted at zero.
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    let outer = 0;
    let inner = 0;
    outer = requestAnimationFrame(() => {
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
    <ul className={cx('grid gap-2 sm:gap-3 lg:gap-4', columns(people.length))}>
      {people.map((person, index) => (
        <li key={person.id} className="@container min-w-0">
          <PaydayCard
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
 * One person's card. Its layout follows its own width (container queries), not the screen's:
 * under 8.5rem (three across a phone) the avatar sits above the name; from 8.5rem beside it; from
 * 21rem (a lone card on a phone, two across a tablet, three on a desktop) the countdown moves to
 * the right of the name, like the Shopping row.
 */
function PaydayCard({
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
  const progress = cycleProgress(first, now);
  const spoken = [first, other]
    .filter((payday): payday is Payday => Boolean(payday))
    .map((payday) => say(payday, now, t))
    .join('. ');

  const classes = cx(
    'flex h-full flex-col rounded-[1.25rem] p-2.5 text-ink-900 shadow-[var(--shadow-card)] @min-[8.5rem]:p-3.5 @min-[21rem]:p-4',
    'animate-deal',
    today ? 'bg-mint-200' : 'bg-white',
    mine &&
      'press transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]',
  );
  const style: CSSProperties = { animationDelay: `${dealDelay(index)}ms` };
  const muted = today ? 'text-mint-800' : 'text-ink-600';

  const body: ReactNode = (
    <>
      <span className="flex flex-col gap-2.5 @min-[21rem]:flex-row @min-[21rem]:items-start @min-[21rem]:justify-between @min-[21rem]:gap-4">
        <span className="flex min-w-0 flex-col items-start gap-1.5 @min-[8.5rem]:flex-row @min-[8.5rem]:items-center @min-[8.5rem]:gap-2">
          <Avatar person={person} size="sm" />
          <span className="block max-w-full truncate text-[0.8125rem] font-bold leading-tight">
            {person.name}
          </span>
        </span>

        <span aria-hidden="true" className="block min-w-0 @min-[21rem]:text-right">
          <span
            aria-live="off"
            className="flex flex-wrap items-baseline gap-x-1 gap-y-1 font-bold leading-none tracking-[-0.03em] tabular-nums @min-[21rem]:justify-end"
          >
            <Count payday={first} now={now} t={t} />
          </span>
          <span className="mt-1.5 flex flex-wrap gap-x-1.5 text-xs leading-snug @min-[21rem]:justify-end">
            <span className="font-semibold">{t.kind[first.kind]}</span>
            <span className={muted}>{today ? t.today : dates().headline.format(first.date)}</span>
          </span>
        </span>
      </span>

      <span
        aria-hidden="true"
        className={cx(
          'mt-3 block h-1.5 overflow-hidden rounded-pill @min-[21rem]:mt-3.5',
          today ? 'bg-white/70' : 'bg-lav-100',
        )}
      >
        <span
          className={cx(
            'block h-full rounded-pill transition-[width] duration-[900ms] ease-(--ease-out) motion-reduce:transition-none',
            today ? 'bg-mint-800' : 'bg-lav-600',
          )}
          style={{
            width: `${(grown ? progress : 0) * 100}%`,
            transitionDelay: grown ? `${dealDelay(index) + 220}ms` : undefined,
          }}
        />
      </span>

      {other ? (
        <span
          aria-hidden="true"
          className="mt-2 flex flex-wrap gap-x-1.5 text-xs leading-snug @min-[21rem]:mt-2.5"
        >
          <span className="font-semibold">{t.kind[other.kind]}</span>
          <span className={muted}>{dates().other.format(other.date)}</span>
        </span>
      ) : null}

      <span className="sr-only">{spoken}</span>
    </>
  );

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

/** "14 days", "27 h 05 min", "4 min 09 s" or "Payday": numbers large, units small. */
function Count({ payday, now, t }: { payday: Payday; now: Date; t: T }) {
  const left = countdown(payday.date, now);
  const pad = (value: number) => formatNumber(value, { minimumIntegerDigits: 2 });
  switch (left.unit) {
    case 'today':
      return <Value>{t.payday}</Value>;
    case 'days':
      return <Part value={formatNumber(left.days)} unit={t.days(left.days)} />;
    case 'hours':
      return (
        <>
          <Part value={formatNumber(left.hours)} unit={t.hours} />
          <Part value={pad(left.minutes)} unit={t.minutes} />
        </>
      );
    case 'minutes':
      return (
        <>
          <Part value={formatNumber(left.minutes)} unit={t.minutes} />
          <Part value={pad(left.seconds)} unit={t.seconds} />
        </>
      );
  }
}

function Value({ children }: { children: ReactNode }) {
  return (
    <span className="text-[1.25rem] @min-[8.5rem]:text-[1.5rem] @min-[21rem]:text-[1.75rem]">
      {children}
    </span>
  );
}

function Part({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="whitespace-nowrap">
      <Value>{value}</Value>
      <span className="ml-0.5 text-xs font-semibold tracking-normal">{unit}</span>
    </span>
  );
}

/** The sentence a screen reader hears, by calendar day so it doesn't change every second. */
function say(payday: Payday, now: Date, t: T): string {
  const kind = t.kind[payday.kind];
  const days = calendarDaysUntil(payday.date, now);
  const date = dates().spoken.format(payday.date);
  if (days <= 0) return t.sayToday(kind);
  if (days === 1) return t.sayTomorrow(kind, date);
  return t.sayIn(kind, days, date);
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
