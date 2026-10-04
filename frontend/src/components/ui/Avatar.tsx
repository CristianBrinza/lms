import { useState } from 'react';
import { cx } from '@/lib/cx';
import { initials } from '@/lib/format';

/** Pastel by name, so a person keeps their colour everywhere. Ink letters on every one (AA). */
const TONES = [
  'bg-peach-200',
  'bg-sky-200',
  'bg-mint-200',
  'bg-pink-200',
  'bg-cyan-200',
  'bg-lav-200',
];

function toneFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length]!;
}

interface AvatarProps {
  person: { id?: string; name: string; surname: string; avatarUrl?: string | null };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: 'size-9 text-xs',
  md: 'size-12 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
} as const;

/** The person's picture when they have one; their initials on their colour otherwise (and if it fails to load). */
export function Avatar({ person, size = 'md', className }: AvatarProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const photo = person.avatarUrl && broken !== person.avatarUrl ? person.avatarUrl : null;
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold tracking-tight text-ink-900 ring-2 ring-white',
        photo ? 'bg-ink-100' : toneFor(person.id ?? `${person.name}${person.surname}`),
        SIZES[size],
        className,
      )}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setBroken(photo)}
        />
      ) : (
        initials(person)
      )}
    </span>
  );
}
