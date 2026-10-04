import { passwordScore } from '@/lib/passwordScore';
import { cx } from '@/lib/cx';

const LABELS = ['Too short', 'Okay', 'Good', 'Strong'] as const;
const FILLS = ['bg-ink-200', 'bg-peach-200', 'bg-butter-300', 'bg-success-600'] as const;

/** Three segments filling as the password gets stronger, with a word for it. */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  return (
    <div className="flex items-center gap-3 animate-fade-in" aria-live="polite">
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className="relative h-1.5 flex-1 overflow-hidden rounded-pill bg-ink-100"
          >
            <span
              className={cx(
                'absolute inset-0 origin-left rounded-pill transition-[scale,background-color] duration-300 ease-(--ease-out)',
                score >= segment ? FILLS[score] : 'bg-transparent',
              )}
              style={{ scale: score >= segment ? '1 1' : '0 1' }}
            />
          </span>
        ))}
      </div>
      <span
        className={cx(
          'w-16 text-right text-xs font-semibold',
          score === 0 ? 'text-ink-500' : 'text-ink-800',
        )}
      >
        {LABELS[score]}
      </span>
    </div>
  );
}

/** A check that pops in when the repeated password matches. */
export function MatchMark({ password, repeat }: { password: string; repeat: string }) {
  if (!repeat) return null;
  const matches = password === repeat;
  return (
    <p
      className={cx(
        'flex items-center gap-1.5 text-sm font-medium animate-fade-in',
        matches ? 'text-success-600' : 'text-ink-500',
      )}
      aria-live="polite"
    >
      {matches ? 'Passwords match' : 'Keep typing: they don’t match yet'}
    </p>
  );
}
