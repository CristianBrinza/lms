import { Avatar } from '@/components/ui';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { useTrainingT } from '../i18n';
import { usePerson } from '../person';

/**
 * Whose training: one round face per person in the household, the chosen one ringed in ink with
 * their name beside it. Hidden when there's only one person (nothing to switch).
 */
export function PersonSwitcher({
  className,
  tone = 'field',
}: {
  className?: string;
  tone?: 'field' | 'ink';
}) {
  const { personId, people, setPerson } = usePerson();
  const t = useTrainingT();
  if (people.length < 2) return null;
  return (
    <div
      role="radiogroup"
      aria-label={t.whoseTraining}
      className={cx('flex items-center gap-1.5 overflow-x-auto', className)}
    >
      {people.map((p) => {
        const chosen = p.id === personId;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => {
              if (chosen) return;
              haptic('tap');
              setPerson(p.id);
            }}
            className={cx(
              'press flex h-11 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-1 text-sm font-semibold transition-colors',
              chosen
                ? tone === 'ink'
                  ? 'bg-white text-ink-900'
                  : 'bg-ink-900 text-white'
                : tone === 'ink'
                  ? 'bg-white/10 text-white/80 hover:bg-white/15'
                  : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-lav-50',
            )}
          >
            <Avatar person={p} size="sm" className="size-9 ring-0" />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
