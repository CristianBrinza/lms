import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button, ButtonLink, Chips, toast } from '@/components/ui';
import { LibraryIcon, UploadIcon } from '@/components/ui/icons';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { watchingApi, watchingKeys } from '../api';
import { Section, WatchingScreen } from '../components/parts';
import { useWatchingT } from '../i18n';
import type { ImportReport, ImportSource } from '../types';

/** The server takes 12 MB a request; a file is sent as text, with room to spare. */
const MAX_BYTES = 8 * 1024 * 1024;
/** A big history takes several rounds (the server works in time slices and says what's left). */
const MAX_ROUNDS = 12;

interface Totals {
  matched: number;
  added: number;
  duplicates: number;
  statuses: number;
  ratings: number;
  unmatched: ImportReport['unmatched'];
}

const EMPTY: Totals = {
  matched: 0,
  added: 0,
  duplicates: 0,
  statuses: 0,
  ratings: 0,
  unmatched: [],
};

/**
 * A file's rounds as one result: each round reads the whole file again, so the plays added add
 * up, the rest is the last round's (plays added in earlier rounds come back as already there).
 */
function fileTotals(reports: ImportReport[]): Totals {
  const last = reports.at(-1)!;
  const added = reports.reduce((sum, r) => sum + r.plays.added, 0);
  return {
    matched: last.titles.matched,
    added,
    duplicates: Math.max(0, last.plays.duplicates - (added - last.plays.added)),
    statuses: reports.reduce((sum, r) => sum + r.statuses, 0),
    ratings: last.ratings,
    unmatched: last.unmatched,
  };
}

const plus = (a: Totals, b: Totals): Totals => ({
  matched: a.matched + b.matched,
  added: a.added + b.added,
  duplicates: a.duplicates + b.duplicates,
  statuses: a.statuses + b.statuses,
  ratings: a.ratings + b.ratings,
  unmatched: [...a.unmatched, ...b.unmatched],
});

/**
 * History from TV Time or Trakt: pick the export's files, each goes up in turn (again while the
 * server says some titles are left), then what matched and what didn't. Safe to repeat: plays
 * already here are skipped.
 */
export default function ImportPage() {
  const t = useWatchingT();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ImportSource>('tvtime');
  const [busy, setBusy] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  const run = async (files: File[]) => {
    let sum = totals ?? EMPTY;
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        toast.error(t.import.tooBig(file.name));
        continue;
      }
      setBusy(file.name);
      try {
        const data = await file.text();
        const before = sum;
        const reports: ImportReport[] = [];
        for (let round = 1; round <= MAX_ROUNDS; round++) {
          const report = await watchingApi.importHistory({ source, data, filename: file.name });
          reports.push(report);
          sum = plus(before, fileTotals(reports));
          setTotals(sum);
          if (!report.titles.pending) break;
        }
      } catch (error) {
        toast.error(file.name, { description: errorMessage(error) });
      }
    }
    setBusy(null);
    if (input.current) input.current.value = '';
    haptic('success');
    toast.success(t.import.done(sum.added));
    void client.invalidateQueries({ queryKey: watchingKeys.all });
  };

  return (
    <WatchingScreen title={t.import.title} subtitle={t.import.subtitle}>
      <section className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)]">
        <Chips
          label={t.import.source}
          tone="sheet"
          dense
          value={source}
          onChange={setSource}
          options={(['tvtime', 'trakt'] as const).map((value) => ({
            value,
            label: t.import.sources[value],
          }))}
        />
        <p className="mt-3 max-w-prose text-sm text-ink-700">
          {source === 'tvtime' ? t.import.howTvtime : t.import.howTrakt}
        </p>
        <p className="mt-1 text-xs text-ink-500">{t.import.again}</p>
        <input
          ref={input}
          type="file"
          multiple
          accept=".csv,.json,text/csv,application/json"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void run([...(e.target.files ?? [])])}
        />
        <Button
          className="mt-4"
          size="md"
          icon={UploadIcon}
          loading={busy !== null}
          onClick={() => input.current?.click()}
        >
          {totals ? t.import.another : t.import.pick}
        </Button>
        {busy ? (
          <p aria-live="polite" className="mt-2 truncate text-sm text-ink-600">
            {t.import.reading(busy)}
          </p>
        ) : null}
      </section>

      {totals ? (
        <>
          <section
            aria-live="polite"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-pink-100 px-4 py-3.5"
          >
            <div className="min-w-0 text-sm text-ink-800">
              <p className="font-semibold">{t.import.added(totals.added)}</p>
              <p>
                {[
                  t.import.matched(totals.matched),
                  totals.duplicates ? t.import.duplicates(totals.duplicates) : null,
                  totals.statuses || totals.ratings
                    ? t.import.extras(totals.statuses, totals.ratings)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <ButtonLink to="/watching/library" size="sm" icon={LibraryIcon}>
              {t.import.library}
            </ButtonLink>
          </section>
          {totals.unmatched.length ? (
            <Section title={`${t.import.unmatched} · ${totals.unmatched.length}`}>
              <p className="-mt-1 mb-2 px-0.5 text-sm text-ink-600">{t.import.unmatchedHint}</p>
              <ul className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]">
                {totals.unmatched.slice(0, 300).map((row, i) => (
                  <li
                    key={`${row.title}-${i}`}
                    className="border-b border-ink-100 px-4 py-2.5 last:border-0"
                  >
                    <span className="block truncate text-sm font-semibold">
                      {row.title ?? '—'}
                      {row.year ? ` (${row.year})` : ''}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {[t.common.plays(row.rows), row.reason].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}
    </WatchingScreen>
  );
}
