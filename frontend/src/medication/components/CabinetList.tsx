import { Link } from 'react-router';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { CabinetMedicine, Package } from '../api';
import { useDiscard } from '../hooks';
import { useMedicationT } from '../i18n';
import { groupByPlace } from '../logic';
import { ExpiryChip, Thumb } from './parts';

/** One package, in a line: what it is, how much is left, its colour chip and, if expired, the bin. */
export function PackageLine({
  pkg,
  unit,
  form,
  onEdit,
}: {
  pkg: Package;
  unit: CabinetMedicine['unit'];
  form: CabinetMedicine['form'];
  onEdit?: () => void;
}) {
  const t = useMedicationT();
  const discard = useDiscard();
  const expired = pkg.status === 'expired';
  const Row = onEdit ? 'button' : 'div';
  return (
    <div className="flex items-center gap-2 py-2">
      <Row
        {...(onEdit ? { type: 'button' as const, onClick: onEdit } : {})}
        className={cx('flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left', onEdit && 'press')}
      >
        <span className="text-sm font-semibold">
          {t.packageKind[pkg.kind]}
          <span className="font-medium text-ink-600">
            {' · '}
            {pkg.quantity > 0 ? t.leftLabel(t.qty(pkg.quantity, unit, form)) : t.none}
          </span>
        </span>
        <ExpiryChip pkg={pkg} />
        {pkg.openedOn ? (
          <span className="text-xs font-medium text-ink-500">{t.opened}</span>
        ) : null}
        {pkg.batch ? <span className="tabular text-xs text-ink-500">{t.batch} {pkg.batch}</span> : null}
      </Row>
      {expired ? (
        <Button
          size="sm"
          variant="danger"
          className="shrink-0"
          loading={discard.isPending}
          onClick={() => discard.mutate(pkg.id)}
        >
          {t.discard}
        </Button>
      ) : null}
    </div>
  );
}

/** The cabinet by place: each place a card, each medicine in it with its packages and chips. */
export function CabinetList({ medicines }: { medicines: CabinetMedicine[] }) {
  const t = useMedicationT();
  const groups = groupByPlace(medicines);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.place || 'none'} aria-label={group.place || t.noPlace}>
          <h2 className="mb-2 px-1 text-[0.9375rem] font-bold tracking-[-0.01em] text-ink-700">
            {group.place || t.noPlace}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {group.entries.map(({ medicine, packages }, index) => (
              <li
                key={medicine.id}
                className="animate-rise rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]"
                style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }}
              >
                <Link to={`/medication/${medicine.id}`} viewTransition className="press flex items-center gap-3">
                  <Thumb cover={medicine.cover} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1.0625rem] font-semibold tracking-[-0.01em]">
                      {medicine.name}
                      {medicine.strength ? (
                        <span className="font-medium text-ink-600"> {medicine.strength}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-600">
                      {[t.form[medicine.form], medicine.ownerName, medicine.rx ? 'Rx' : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="tabular mt-0.5 block text-sm font-semibold">
                      {medicine.available > 0
                        ? t.leftLabel(t.qty(medicine.available, medicine.unit, medicine.form))
                        : t.none}
                    </span>
                  </span>
                  {medicine.low ? (
                    <span className="inline-flex h-7 shrink-0 items-center rounded-pill bg-butter-300 px-2.5 text-xs font-bold">
                      {t.filter.low}
                    </span>
                  ) : null}
                </Link>
                {packages.length ? (
                  <div className="mt-2 divide-y divide-ink-100 border-t border-ink-100">
                    {packages.map((pkg) => (
                      <PackageLine key={pkg.id} pkg={pkg} unit={medicine.unit} form={medicine.form} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
