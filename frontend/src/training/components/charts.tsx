import { useLayoutEffect, useRef } from 'react';
import { dayAndMonth, parseDay } from '@/food/format';
import { cx } from '@/lib/cx';
import { heatWeeks, monthLabels, niceMax, scale, spread, type HeatCell } from './chartData';

/**
 * Training's small charts, no library: a line of bests over time, bars per week, and a calendar of
 * days trained. Each is one picture to assistive tech (role="img" with a sentence that says what
 * it shows); the marks themselves are hidden from it.
 */

// ---------------------------------------------------------------- line

export interface LinePoint {
  day: string;
  value: number;
}

/**
 * A value over time, oldest on the left: a filled line, the latest point marked, the top value
 * and the first and last dates as labels. The marks stretch to any width (the stroke stays 2px).
 */
export function LineChart({
  points,
  format,
  label,
  className,
}: {
  points: LinePoint[];
  format: (value: number) => string;
  /** What the chart shows, read with the summary ("Best set per day"). */
  label: string;
  className?: string;
}) {
  const W = 100;
  const H = 100;
  const max = Math.max(0, ...points.map((p) => p.value));
  const top = niceMax(max);
  const y = scale(top, H - 4, 6);
  const xs = spread(points.length, 2, W - 2);
  const coords = points.map((p, i) => [xs[i]!, y(p.value)] as const);
  const line = coords
    .map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`)
    .join(' ');
  const area = coords.length
    ? `${line} L${coords.at(-1)![0].toFixed(2)},${H} L${coords[0]![0].toFixed(2)},${H} Z`
    : '';
  const last = points.at(-1);
  const first = points[0];
  const best = points.reduce<LinePoint | null>((b, p) => (!b || p.value > b.value ? p : b), null);
  const summary = last
    ? `${label}: ${points.length} ${points.length === 1 ? 'day' : 'days'} from ${dayAndMonth(first!.day)} to ${dayAndMonth(last.day)}. Latest ${format(last.value)}, best ${format(best!.value)} on ${dayAndMonth(best!.day)}.`
    : `${label}: nothing yet.`;
  const lastXY = coords.at(-1);

  return (
    <figure role="img" aria-label={summary} className={cx('relative', className)}>
      <div
        aria-hidden="true"
        className="flex items-baseline justify-between gap-2 text-xs font-semibold text-ink-500"
      >
        <span className="tabular">{format(top)}</span>
        {last ? <span className="tabular text-ink-800">Latest {format(last.value)}</span> : null}
      </div>
      <div aria-hidden="true" className="relative mt-1 h-28 border-b border-ink-200">
        <div className="absolute inset-x-0 top-[6%] border-t border-dashed border-ink-100" />
        <div className="absolute inset-x-0 top-[51%] border-t border-dashed border-ink-100" />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          {area ? <path d={area} className="fill-lav-100" /> : null}
          {coords.length > 1 ? (
            <path
              d={line}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-lav-600"
            />
          ) : null}
        </svg>
        {/* Round dots in HTML: the stretched SVG would make them ovals. */}
        {points.length <= 31
          ? coords
              .slice(0, -1)
              .map(([px, py], i) => (
                <span
                  key={points[i]!.day}
                  className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lav-600"
                  style={{ left: `${px}%`, top: `${py}%` }}
                />
              ))
          : null}
        {lastXY ? (
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-900 ring-[3px] ring-white"
            style={{ left: `${lastXY[0]}%`, top: `${lastXY[1]}%` }}
          />
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="tabular mt-1 flex justify-between text-xs font-medium text-ink-500"
      >
        <span>{first ? dayAndMonth(first.day) : ''}</span>
        <span>{last && last !== first ? dayAndMonth(last.day) : ''}</span>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------- bars

export interface Bar {
  key: string;
  /** Under the bar (shown for some bars when there are many). */
  label: string;
  value: number;
  /** Drawn in ink: this week, today. */
  current?: boolean;
  /** Tooltip and the bar's line in the summary. */
  title?: string;
}

/** Bars side by side, all sharing one scale; every nth labelled so the labels never collide. */
export function BarChart({
  bars,
  format,
  label,
  className,
}: {
  bars: Bar[];
  format: (value: number) => string;
  label: string;
  className?: string;
}) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  const top = niceMax(max);
  const height = scale(top, 0, 100);
  const every = Math.max(1, Math.ceil(bars.length / 5));
  const total = bars.reduce((sum, b) => sum + b.value, 0);
  const busiest = bars.reduce<Bar | null>((b, bar) => (!b || bar.value > b.value ? bar : b), null);
  const summary = bars.length
    ? `${label}: ${bars.length} bars, ${format(total)} in all${busiest && busiest.value > 0 ? `, most ${format(busiest.value)} (${busiest.title ?? busiest.label})` : ''}.`
    : `${label}: nothing yet.`;

  return (
    <figure role="img" aria-label={summary} className={cx('relative', className)}>
      <div
        aria-hidden="true"
        className="flex items-baseline justify-between text-xs font-semibold text-ink-500"
      >
        <span className="tabular">{format(top)}</span>
      </div>
      <div
        aria-hidden="true"
        className="relative mt-1 flex h-32 items-end gap-[3px] border-b border-ink-200 sm:gap-1"
      >
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-ink-100" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink-100" />
        {bars.map((bar) => (
          <span
            key={bar.key}
            title={`${bar.title ?? bar.label}: ${format(bar.value)}`}
            className="relative flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={cx(
                'w-full rounded-t-[0.3rem] transition-[height] duration-500 ease-(--ease-out)',
                bar.current ? 'bg-ink-900' : bar.value > 0 ? 'bg-lav-400' : 'bg-transparent',
              )}
              style={{ height: bar.value > 0 ? `max(${height(bar.value)}%, 3px)` : 0 }}
            />
          </span>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-[3px] sm:gap-1">
        {bars.map((bar, i) => (
          <span
            key={bar.key}
            className="tabular min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[0.6875rem] font-medium text-ink-500"
          >
            {(bars.length - 1 - i) % every === 0 ? bar.label : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------- calendar

const HEAT_TONES: Record<HeatCell['level'], string> = {
  0: 'bg-ink-100',
  1: 'bg-lav-200',
  2: 'bg-lav-400',
  3: 'bg-lav-600',
  4: 'bg-lav-800',
};

const monthShort = new Intl.DateTimeFormat('en', { month: 'short' });
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/**
 * Days trained as squares, a column per week (Monday on top), darker for busier days. Wider than
 * the screen (a year on a phone) it scrolls sideways and opens at the latest week.
 */
export function HeatMap({
  from,
  to,
  values,
  today,
  describe,
  className,
}: {
  from: string;
  to: string;
  values: Map<string, number>;
  today: string;
  /** A cell's tooltip ("Tue 6 Oct: 12 sets"). */
  describe: (day: string, value: number) => string;
  className?: string;
}) {
  const weeks = heatWeeks(from, to, values);
  const months = monthLabels(weeks);
  const scroller = useRef<HTMLDivElement>(null);
  const trained = weeks.flat().filter((cell) => !cell.outside && cell.value > 0).length;
  const days = weeks.flat().filter((cell) => !cell.outside).length;

  useLayoutEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [from, to]);

  return (
    <figure
      role="img"
      aria-label={`Trained on ${trained} of ${days} days, ${dayAndMonth(from)} to ${dayAndMonth(to)}.`}
      className={cx('min-w-0', className)}
    >
      <div aria-hidden="true" className="flex gap-1.5">
        <div className="grid shrink-0 grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-[3px] pr-0.5 text-[0.6875rem] font-medium text-ink-500">
          <span className="h-4" />
          {WEEKDAYS.map((name, i) => (
            <span key={i} className="flex items-center leading-none">
              {name}
            </span>
          ))}
        </div>
        <div
          ref={scroller}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]"
        >
          <div
            className="grid grid-flow-col gap-[3px]"
            style={{
              // Up to 20 weeks fit any screen and share its width; a year keeps 0.875rem squares and scrolls.
              gridTemplateColumns:
                weeks.length > 20
                  ? `repeat(${weeks.length}, 0.875rem)`
                  : `repeat(${weeks.length}, minmax(0, 1fr))`,
              // Squares no bigger than 1.75rem: wide panels leave room on the right instead.
              maxWidth: `calc(${weeks.length} * 1.75rem + ${weeks.length - 1} * 3px)`,
            }}
          >
            {weeks.map((week, w) => {
              const month = months[w];
              return (
                <div
                  key={week[0]!.day}
                  className="grid min-w-0 grid-rows-[auto_repeat(7,auto)] gap-[3px]"
                >
                  {/* No width of its own: the name runs over the next columns without widening this one. */}
                  <span className="h-4 w-0 overflow-visible whitespace-nowrap text-[0.6875rem] font-medium leading-4 text-ink-500">
                    {month ? monthShort.format(parseDay(month)) : ''}
                  </span>
                  {week.map((cell) => (
                    <span
                      key={cell.day}
                      title={cell.outside ? undefined : describe(cell.day, cell.value)}
                      className={cx(
                        'block aspect-square w-full rounded-[0.25rem]',
                        cell.outside ? 'bg-transparent' : HEAT_TONES[cell.level],
                        cell.day === today &&
                          (cell.level >= 3
                            ? 'ring-2 ring-inset ring-butter-300'
                            : 'ring-2 ring-inset ring-ink-900'),
                      )}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mt-2 flex items-center justify-end gap-1 text-[0.6875rem] font-medium text-ink-500"
      >
        Less
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className={cx('size-2.5 rounded-[0.2rem]', HEAT_TONES[level])} />
        ))}
        More
      </div>
    </figure>
  );
}
