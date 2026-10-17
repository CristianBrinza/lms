import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button, Chips, IconButton, Sheet, Skeleton } from '@/components/ui';
import { AddIcon, CloseIcon, SearchIcon, TuneIcon, WineBarIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { CATEGORIES, drinksApi, drinksKeys } from '../api';
import { DrinkCard } from '../components/DrinkCard';
import { DrinkSheet } from '../components/DrinkSheet';
import { DrinksScreen, ErrorCard } from '../components/parts';
import {
  activeFilters,
  countryName,
  filterDrinks,
  NO_FILTERS,
  onShelf,
  type Filters,
  type Shelf,
  type Sort,
} from '../format';
import { useDrinksT } from '../i18n';

/** Remembered while the app is open: coming back from a drink keeps the search and filters. */
let remembered: Filters = NO_FILTERS;

/**
 * The cellar: every drink the household has or has had, as tall covers. Search as you type,
 * the shelf (at home, tried, want to try), kinds, and the rest of the filters in a sheet.
 */
export default function DrinksHomePage() {
  const t = useDrinksT();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: drinksKeys.list, queryFn: drinksApi.list });
  const [filters, setFiltersState] = useState<Filters>(remembered);
  const [adding, setAdding] = useState(false);
  const [tuning, setTuning] = useState(false);
  const setFilters = (next: Filters) => {
    remembered = next;
    setFiltersState(next);
  };
  const patch = (change: Partial<Filters>) => setFilters({ ...filters, ...change });

  const data = query.data;
  const drinks = useMemo(() => data?.drinks ?? [], [data]);
  const shown = useMemo(() => filterDrinks(drinks, filters), [drinks, filters]);
  const bottles = drinks.reduce((sum, d) => sum + d.stock, 0);
  const kinds = CATEGORIES.filter((c) => drinks.some((d) => d.category === c));
  const extra = activeFilters({ ...filters, category: '' });

  return (
    <DrinksScreen
      wide
      nav
      back="/home"
      title={t.title}
      subtitle={data ? t.summary(drinks.length, bottles) : ' '}
      actions={<IconButton icon={AddIcon} label={t.add} variant="ink" onClick={() => setAdding(true)} />}
    >
      {query.isPending ? (
        <div aria-hidden="true">
          <Skeleton className="h-12 rounded-[1.25rem]" />
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-[1.5rem]" />
            ))}
          </div>
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : !drinks.length ? (
        <Empty onAdd={() => setAdding(true)} />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[1.25rem] bg-white px-4 shadow-[var(--shadow-card)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
              <SearchIcon fontSize="inherit" className="shrink-0 text-[1.25rem] text-ink-400" />
              <span className="sr-only">{t.searchLabel}</span>
              <input
                type="search"
                value={filters.q}
                placeholder={t.searchPlaceholder}
                onChange={(e) => patch({ q: e.target.value })}
                className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] font-medium outline-none placeholder:text-ink-400"
              />
              {filters.q ? (
                <button
                  type="button"
                  aria-label={t.clearFilters}
                  onClick={() => patch({ q: '' })}
                  className="press grid size-7 place-items-center rounded-full bg-ink-100 text-base text-ink-600"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              ) : null}
            </label>
            <span className="relative">
              <IconButton
                icon={TuneIcon}
                label={t.filters}
                variant={extra ? 'ink' : 'white'}
                onClick={() => setTuning(true)}
              />
              {extra ? (
                <span className="tabular pointer-events-none absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-butter-300 text-[0.6875rem] font-bold text-ink-900">
                  {extra}
                </span>
              ) : null}
            </span>
          </div>

          <Chips
            label={t.show}
            dense
            tone="sheet"
            className="mt-3"
            value={filters.shelf}
            onChange={(shelf: Shelf) => patch({ shelf })}
            options={(['all', 'cellar', 'tried', 'wanted'] as const).map((shelf) => ({
              value: shelf,
              label: t.shelf[shelf],
              count: drinks.filter((d) => onShelf(d, shelf)).length,
            }))}
          />
          {kinds.length > 1 ? (
            <Chips
              label={t.kinds}
              dense
              tone="sheet"
              value={filters.category || 'all'}
              onChange={(value: string) => patch({ category: value === 'all' ? '' : value })}
              options={[
                { value: 'all', label: t.allKinds },
                ...kinds.map((c) => ({ value: c as string, label: t.category[c] })),
              ]}
            />
          ) : null}

          {shown.length ? (
            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {shown.map((drink, index) => (
                <li key={drink.id}>
                  <DrinkCard drink={drink} index={index} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white p-5 text-center shadow-[var(--shadow-xs)]">
              <p className="text-sm text-ink-600">{t.noMatch}</p>
              <Button size="sm" variant="tint" className="mt-3" onClick={() => setFilters(NO_FILTERS)}>
                {t.clearFilters}
              </Button>
            </div>
          )}
        </>
      )}

      <FilterSheet
        open={tuning}
        onClose={() => setTuning(false)}
        filters={filters}
        onChange={setFilters}
        countries={data?.countries ?? []}
        tags={data?.tags ?? []}
      />
      <DrinkSheet
        open={adding}
        onClose={() => setAdding(false)}
        tags={data?.tags ?? []}
        currency={data?.currency ?? 'MDL'}
        onCreated={(drink) => navigate(`/drinks/${drink.id}`, { viewTransition: true })}
      />
    </DrinksScreen>
  );
}

/** No drinks yet: what this place is for, and the one thing to do. */
function Empty({ onAdd }: { onAdd: () => void }) {
  const t = useDrinksT();
  return (
    <section className="relative mt-2 overflow-hidden rounded-[1.75rem] bg-ink-900 p-6 text-white shadow-[var(--shadow-raised)] sm:p-8">
      <WineBarIcon
        aria-hidden="true"
        fontSize="inherit"
        className="pointer-events-none absolute -right-6 -top-4 text-[11rem] text-white/[0.06]"
      />
      <h2 className="relative max-w-md text-[1.75rem] font-bold leading-tight tracking-[-0.025em]">
        {t.emptyTitle}
      </h2>
      <p className="relative mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-white/75">
        {t.emptyBody}
      </p>
      <p className="relative mt-3 max-w-prose text-sm text-butter-200">{t.emptyHint}</p>
      <button
        type="button"
        onClick={onAdd}
        className="press relative mt-5 inline-flex h-12 items-center gap-2 rounded-pill bg-butter-300 px-5 text-[0.9375rem] font-semibold text-ink-900"
      >
        <AddIcon fontSize="inherit" className="text-xl" />
        {t.add}
      </button>
    </section>
  );
}

function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  countries,
  tags,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (filters: Filters) => void;
  countries: string[];
  tags: string[];
}) {
  const t = useDrinksT();
  const set = (change: Partial<Filters>) => onChange({ ...filters, ...change });
  const pill = (active: boolean) =>
    cx(
      'press h-9 rounded-pill px-3.5 text-sm font-semibold transition-colors',
      active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
    );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.filters}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button fullWidth onClick={onClose}>
            {t.done}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => onChange({ ...NO_FILTERS, q: filters.q, shelf: filters.shelf })}
          >
            {t.clearFilters}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <FilterGroup label={t.sortBy}>
          {(['recent', 'rating', 'name', 'vintage'] as Sort[]).map((sort) => (
            <button
              key={sort}
              type="button"
              aria-pressed={filters.sort === sort}
              onClick={() => set({ sort })}
              className={pill(filters.sort === sort)}
            >
              {t.sort[sort]}
            </button>
          ))}
        </FilterGroup>
        <FilterGroup label={t.rating}>
          {[0, 6, 8, 9].map((min) => (
            <button
              key={min}
              type="button"
              aria-pressed={filters.minRating === min}
              onClick={() => set({ minRating: min })}
              className={pill(filters.minRating === min)}
            >
              {min ? t.atLeast(String(min / 2)) : t.anyRating}
            </button>
          ))}
        </FilterGroup>
        {countries.length ? (
          <FilterGroup label={t.country}>
            <button
              type="button"
              aria-pressed={!filters.country}
              onClick={() => set({ country: '' })}
              className={pill(!filters.country)}
            >
              {t.anyCountry}
            </button>
            {countries.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={filters.country === code}
                onClick={() => set({ country: code })}
                className={pill(filters.country === code)}
              >
                {countryName(code)}
              </button>
            ))}
          </FilterGroup>
        ) : null}
        {tags.length ? (
          <FilterGroup label={t.tags}>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={filters.tag === tag}
                onClick={() => set({ tag: filters.tag === tag ? '' : tag })}
                className={pill(filters.tag === tag)}
              >
                #{tag}
              </button>
            ))}
          </FilterGroup>
        ) : null}
      </div>
    </Sheet>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
