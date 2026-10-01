import { cx } from '@/lib/cx';
import { LogoTile } from './Logo';

/**
 * The yellow app's onboarding card: a soft square card, a little tilted, with two cards in other
 * colours peeking out at the sides. Ours holds the logo and the app's one-word promise.
 */
export function CardFan({ label = 'your life', className }: { label?: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cx('relative mx-auto aspect-square w-full max-w-[17rem]', className)}>
      <span className="absolute -left-[22%] top-[14%] h-[72%] w-[40%] -rotate-[8deg] animate-rise rounded-[1.75rem] bg-butter-200 [animation-delay:60ms]" />
      <span className="absolute -right-[22%] top-[18%] h-[70%] w-[40%] rotate-[7deg] animate-rise rounded-[1.75rem] bg-mint-200 [animation-delay:120ms]" />
      <span className="absolute inset-0 flex -rotate-[4deg] animate-rise flex-col items-center justify-center gap-5 rounded-[2rem] bg-lav-50 shadow-[0_24px_40px_-24px_rgb(42_43_102/0.55)] [animation-delay:200ms]">
        <LogoTile className="w-[38%]" label={null} />
        <span className="text-[1.25rem] font-semibold tracking-[-0.01em] text-ink-900">{label}</span>
      </span>
    </div>
  );
}
