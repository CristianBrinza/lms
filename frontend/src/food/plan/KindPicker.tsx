import { useState } from 'react';
import { Sheet, TextField } from '@/components/ui';
import { CheckIcon, SearchIcon } from '@/components/ui/icons';
import { getLocale, intlLocale, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { formatQty, LOCATION_LABEL } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import { findKinds, kindGroups, type KindGroup } from '../lots';
import type { Lot, StockedProduct } from '../types';
import { dayAndMonth, usePlanT } from './i18n';

export interface PiecePick {
  /** The kind to use ('' for whatever comes first). */
  variant: string;
  /** One exact piece, when a kind has several that differ; null: the kind's first. */
  lotId: string | null;
}

/** Search shows up once the list is longer than a phone screen's worth. */
const SEARCH_FROM = 7;

/**
 * Which one, by name: the item's kinds (Tess Pleasure, Lovaré Champagne Splashes…) each once,
 * with its picture and how much there is; a kind with several pieces lists them under it, told
 * apart by date and place. The first row keeps the usual order: the opened one, then the one
 * that expires first.
 */
export function KindPicker({
  open,
  onClose,
  product,
  lots,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  product: StockedProduct;
  lots: Lot[];
  value: PiecePick;
  onPick: (next: PiecePick) => void;
}) {
  const t = usePlanT();
  const [query, setQuery] = useState('');
  const collator = new Intl.Collator(intlLocale(getLocale()));
  const groups = kindGroups(lots, (a, b) => collator.compare(a, b));
  const name = (group: KindGroup) =>
    group.variant ? tr(group.lots[0]!, 'variant') || group.variant : t.noKind;
  const shown = findKinds(groups, query, (group) => [group.variant, name(group)]);
  const pick = (next: PiecePick) => {
    onPick(next);
    onClose();
  };
  const sameKind = (group: KindGroup) =>
    value.variant.trim().toLowerCase() === group.variant.toLowerCase();

  return (
    <Sheet open={open} onClose={onClose} title={tr(product, 'name')} description={t.whichOne}>
      <div className="flex flex-col gap-2">
        {groups.length >= SEARCH_FROM ? (
          <TextField
            label={t.findKind}
            hideLabel
            dense
            icon={SearchIcon}
            placeholder={t.findKind}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : null}
        <ul className="flex flex-col gap-1">
          {query.trim() ? null : (
            <Row
              on={!value.variant && !value.lotId}
              icon={product.icon}
              title={t.autoLot.charAt(0).toUpperCase() + t.autoLot.slice(1)}
              onClick={() => pick({ variant: '', lotId: null })}
            />
          )}
          {shown.map((group) => (
            <li key={group.variant || '-'}>
              <ul className="flex flex-col gap-0.5">
                <Row
                  on={
                    group.variant
                      ? sameKind(group) && !value.lotId
                      : group.lots.length === 1 && value.lotId === group.lots[0]!.id
                  }
                  icon={product.variantIcons?.[group.variant.toLowerCase()] ?? product.icon}
                  title={name(group)}
                  detail={formatQty(group.total, product)}
                  onClick={() =>
                    pick(
                      group.variant
                        ? { variant: group.variant, lotId: null }
                        : { variant: '', lotId: group.lots[0]!.id },
                    )
                  }
                />
                {group.lots.length > 1
                  ? group.lots.map((lot) => (
                      <Row
                        key={lot.id}
                        nested
                        on={value.lotId === lot.id}
                        title={[
                          formatQty(lot.quantity, product),
                          lot.package || null,
                          lot.openedAt ? t.openedMark.trim() : null,
                          lot.expiresOn ? t.until(dayAndMonth(lot.expiresOn)).replace(/^ · /, '') : null,
                          LOCATION_LABEL[lot.location].toLowerCase(),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        onClick={() => pick({ variant: group.variant, lotId: lot.id })}
                      />
                    ))
                  : null}
              </ul>
            </li>
          ))}
          {!shown.length ? (
            <li className="px-2 py-3 text-sm text-ink-600">{t.noKindMatch}</li>
          ) : null}
        </ul>
      </div>
    </Sheet>
  );
}

function Row({
  on,
  icon,
  title,
  detail,
  nested,
  onClick,
}: {
  on: boolean;
  icon?: string;
  title: string;
  detail?: string;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={on}
        onClick={onClick}
        className={cx(
          'press flex w-full items-center gap-3 rounded-2xl text-left transition-colors',
          nested ? 'min-h-10 py-1.5 pl-[3.75rem] pr-2.5 text-sm' : 'p-1.5 pr-2.5',
          on ? 'bg-mint-100' : 'hover:bg-ink-50',
        )}
      >
        {icon ? (
          <FoodIconTile
            name={icon}
            tone={on ? 'bg-white' : 'bg-ink-50'}
            className="size-10 rounded-xl [&>svg]:size-7"
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span
            className={cx('block truncate', nested ? 'text-ink-700' : 'text-[0.9375rem] font-semibold')}
          >
            {title}
          </span>
        </span>
        {detail ? (
          <span className="tabular shrink-0 text-sm font-semibold text-ink-600">{detail}</span>
        ) : null}
        {on ? <CheckIcon fontSize="inherit" className="shrink-0 text-lg text-mint-800" /> : null}
      </button>
    </li>
  );
}
