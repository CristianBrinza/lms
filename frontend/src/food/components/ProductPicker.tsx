import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { TextField } from '@/components/ui';
import { AddIcon, SearchIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { foodApi, foodKeys } from '../api';
import {
  COMMON,
  fromPreset,
  fromProduct,
  sameName,
  useProductSearch,
  type PickedProduct,
} from '../catalog';
import { CATEGORY_LABEL, LOCATION_LABEL } from '../format';
import { FoodIcon, FoodIconTile } from '../icons/FoodIcon';
import type { Preset, Product } from '../types';

export function ProductPicker({
  onPick,
  autoFocus,
  label = 'What is it?',
}: {
  onPick: (pick: PickedProduct) => void;
  autoFocus?: boolean;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const { results, exact, products, presets } = useProductSearch(query);
  const typed = query.trim();
  // Not known as typed: the API may know it as a type of an item ("guava juice" → Juice, Guava)
  // and guess what a new name is (spices by level, juices on the shelf…).
  const deferred = useDeferredValue(typed);
  const guess = useQuery({
    queryKey: [...foodKeys.all, 'guess', deferred.toLowerCase()],
    queryFn: () => foodApi.guess(deferred),
    enabled: deferred.length >= 3 && !exact,
    staleTime: 5 * 60_000,
  });
  const matched = guess.data?.match ? findPick(guess.data.match.item, products, presets) : null;
  const match =
    matched && guess.data?.match ? { ...matched, variant: guess.data.match.variant } : null;
  const fresh = (name: string) =>
    newItem(name, deferred === typed ? (guess.data?.guess ?? null) : null);
  const common = COMMON.map(
    (name) => products.find((p) => sameName(p.name, name)) ?? presets.find((p) => p.name === name),
  )
    .filter((p): p is Product | Preset => Boolean(p))
    .map((p) => ('id' in p ? fromProduct(p) : fromPreset(p)));

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={label}
        hideLabel
        icon={SearchIcon}
        placeholder="Tomatoes, steak, water…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          if (results[0] && (exact || !typed)) onPick(results[0]);
          else if (match) onPick(match);
          else if (typed) onPick(fresh(typed));
        }}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="next"
      />

      {typed ? (
        <ul className="-mx-2 flex flex-col">
          {results.map((pick) => (
            <li key={pick.productId ?? `preset-${pick.name}`}>
              <PickRow pick={pick} onPick={onPick} />
            </li>
          ))}
          {match && !exact ? (
            <li>
              <button
                type="button"
                onClick={() => onPick(match)}
                className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-ink-50"
              >
                <FoodIconTile name={match.icon} tone="bg-butter-100" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold">
                    {match.name} · {match.variant}
                  </span>
                  <span className="block truncate text-sm text-ink-600">
                    {match.variants.some((v) => sameName(v, match.variant!))
                      ? `A kind of ${match.name.toLowerCase()}`
                      : `A new kind of ${match.name.toLowerCase()}`}
                  </span>
                </span>
              </button>
            </li>
          ) : null}
          {!exact ? (
            <li>
              <button
                type="button"
                onClick={() => onPick(fresh(typed))}
                className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-ink-50"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lav-100 text-[1.4rem] text-lav-800">
                  <AddIcon fontSize="inherit" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold">
                    Add “{typed}”
                  </span>
                  <span className="block text-sm text-ink-600">A new item for your kitchen</span>
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <div>
          <p className="mb-2.5 text-[0.8125rem] font-semibold text-ink-700">Common</p>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {common.map((pick) => (
              <li key={pick.name}>
                <button
                  type="button"
                  onClick={() => onPick(pick)}
                  className="press flex w-full flex-col items-center gap-1 rounded-2xl bg-ink-50 px-1 pb-2 pt-2.5 transition-colors hover:bg-butter-100"
                >
                  <FoodIcon name={pick.icon} className="size-9" />
                  <span className="w-full truncate text-center text-xs font-semibold">
                    {pick.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The kitchen's item, else the catalog food, with this name. */
function findPick(name: string, products: Product[], presets: Preset[]): PickedProduct | null {
  const own = products.find((p) => sameName(p.name, name));
  if (own) return fromProduct(own);
  const food = presets.find((p) => p.name === name);
  return food ? fromPreset(food) : null;
}

/** A name nobody knows yet, shaped by the API's guess (a sauce is kept by level, juice on the shelf). */
function newItem(name: string, guess: Preset | null): PickedProduct {
  const tidy = name.replace(/\s+/g, ' ').trim();
  return {
    name: tidy.charAt(0).toUpperCase() + tidy.slice(1),
    icon: guess?.icon ?? 'basket',
    category: guess?.category ?? 'other',
    unit: guess?.unit ?? 'pcs',
    pieceSize: guess?.pieceSize ?? null,
    pieceUnit: guess?.pieceUnit ?? null,
    location: guess?.location ?? 'pantry',
    shelfLifeDays: guess?.shelfLifeDays ?? null,
    units: guess?.units ?? [],
    variants: guess?.variants ?? [],
    trackMode: guess?.track ?? 'exact',
    isNew: true,
  };
}

function PickRow({ pick, onPick }: { pick: PickedProduct; onPick: (pick: PickedProduct) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(pick)}
      className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-ink-50"
    >
      <FoodIconTile name={pick.icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{pick.name}</span>
        <span
          className={cx('block truncate text-sm', pick.productId ? 'text-ink-600' : 'text-ink-500')}
        >
          {pick.productId
            ? 'In your kitchen’s list'
            : `${CATEGORY_LABEL[pick.category]} · ${LOCATION_LABEL[pick.location]}${pick.shelfLifeDays ? ` · keeps ~${pick.shelfLifeDays} d` : ''}`}
        </span>
      </span>
    </button>
  );
}
