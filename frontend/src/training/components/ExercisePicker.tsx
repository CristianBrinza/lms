import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Sheet, Skeleton, Switch } from '@/components/ui';
import { SearchIcon } from '@/components/ui/icons';
import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { trainingApi, trainingKeys } from '../api';
import { CATEGORY_LABEL, CATEGORY_ORDER, MUSCLE_LABEL } from '../format';
import { ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { ExerciseCategory, LibraryExercise } from '../types';
import { usePickersT } from './pickers.i18n';

/** Pick exercises to add, one tap each; what can be done at home first, the rest on request. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  added = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: LibraryExercise) => void;
  /** Already in the workout: marked, still pickable (a second block of the same). */
  added?: string[];
}) {
  const t = usePickersT().picker;
  const { personId } = usePerson();
  const exercises = useQuery({
    queryKey: trainingKeys.exercises(personId),
    queryFn: () => trainingApi.exercises(personId),
    enabled: open,
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [homeOnly, setHomeOnly] = useState(true);
  const q = search.trim().toLowerCase();
  const list = useMemo(
    () =>
      (exercises.data ?? []).filter(
        (e) =>
          (!homeOnly || e.available) &&
          (category === 'all' || e.category === category) &&
          (!q ||
            tr(e, 'name').toLowerCase().includes(q) ||
            e.name.toLowerCase().includes(q) ||
            e.muscles.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(q))),
      ),
    [exercises.data, homeOnly, category, q],
  );
  const chip = (active: boolean) =>
    cx(
      'press h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors',
      active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
    );

  return (
    <Sheet open={open} onClose={onClose} title={t.title} size="lg">
      <div className="flex flex-col gap-3">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-ink-50 px-4 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
          <SearchIcon fontSize="inherit" className="text-[1.25rem] text-ink-500" />
          <span className="sr-only">{t.find}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.placeholder}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-400"
          />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label={t.kind}>
          <button
            type="button"
            aria-pressed={category === 'all'}
            className={chip(category === 'all')}
            onClick={() => setCategory('all')}
          >
            {t.all}
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={chip(category === c)}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <Switch checked={homeOnly} onChange={setHomeOnly} label={t.homeOnly} />
        {exercises.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-ink-50"
                >
                  <span
                    className={cx(
                      'grid size-12 shrink-0 place-items-center rounded-xl',
                      added.includes(e.id) ? 'bg-mint-100' : 'bg-ink-50',
                    )}
                  >
                    <ExerciseIcon name={e.icon} className="size-10" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{tr(e, 'name')}</span>
                    <span className="block truncate text-xs text-ink-600">
                      {added.includes(e.id) ? t.inWorkout : ''}
                      {e.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}
                      {!e.available ? t.needsEquipment : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!list.length ? <li className="px-2 py-6 text-sm text-ink-600">{t.empty}</li> : null}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
