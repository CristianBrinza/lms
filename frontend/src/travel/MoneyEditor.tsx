import { AddIcon, CloseIcon } from '@/components/ui/icons';
import type { Money } from './types';

const CURRENCIES = ['MDL', 'EUR', 'RON', 'USD', 'UAH', 'GBP'];

const well =
  'h-11 min-w-0 rounded-[1rem] bg-ink-50 px-3 text-[0.9375rem] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]';

/**
 * The money a trip needs: cash and cards, each with its currency and how much ("Cash, 2000 MDL",
 * "Euro card, 300 EUR"). Ticked as ready on the trip itself.
 */
export function MoneyEditor({
  value,
  onChange,
}: {
  value: Money[];
  onChange: (next: Money[]) => void;
}) {
  const set = (id: string, patch: Partial<Money>) =>
    onChange(value.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const add = (kind: Money['kind']) =>
    onChange([
      ...value,
      {
        id: crypto.randomUUID(),
        kind,
        label: kind === 'cash' ? 'Cash' : 'Card',
        currency: kind === 'cash' ? 'MDL' : 'EUR',
        amount: null,
        ready: false,
      },
    ]);
  return (
    <div className="flex flex-col gap-2">
      {value.map((m) => (
        <div key={m.id} className="flex items-center gap-1.5">
          <input
            aria-label={m.kind === 'cash' ? 'Cash: name' : 'Card: name'}
            value={m.label}
            maxLength={60}
            onChange={(e) => set(m.id, { label: e.target.value })}
            placeholder={m.kind === 'cash' ? 'Cash' : 'Euro card'}
            className={`${well} flex-[1.6]`}
          />
          <input
            aria-label={`${m.label || 'Money'}: how much`}
            inputMode="decimal"
            value={m.amount ?? ''}
            placeholder="How much"
            onChange={(e) => {
              const n = Number(e.target.value.replace(',', '.'));
              set(m.id, {
                amount: e.target.value.trim() && Number.isFinite(n) && n >= 0 ? n : null,
              });
            }}
            className={`${well} tabular flex-1 text-right`}
          />
          <select
            aria-label={`${m.label || 'Money'}: currency`}
            value={m.currency}
            onChange={(e) => set(m.id, { currency: e.target.value })}
            className={`${well} w-[4.75rem] shrink-0 px-2 font-semibold`}
          >
            {(CURRENCIES.includes(m.currency) ? CURRENCIES : [m.currency, ...CURRENCIES]).map(
              (c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ),
            )}
          </select>
          <button
            type="button"
            aria-label={`Remove ${m.label || 'this'}`}
            onClick={() => onChange(value.filter((x) => x.id !== m.id))}
            className="press grid size-10 shrink-0 place-items-center rounded-full text-[1.2rem] text-ink-500 hover:bg-ink-50 hover:text-ink-900"
          >
            <CloseIcon fontSize="inherit" />
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <AddButton onClick={() => add('cash')}>Cash</AddButton>
        <AddButton onClick={() => add('card')}>Card</AddButton>
      </div>
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-ink-50 px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-100"
    >
      <AddIcon fontSize="inherit" className="text-[1.1rem]" />
      {children}
    </button>
  );
}
