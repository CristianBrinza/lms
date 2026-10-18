import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import type { Care } from '../api';
import { useClosetT } from '../i18n';

/**
 * The care label's symbols (ISO 3758), drawn as our own monoline icons, each with what it means in
 * plain words. One stroke weight, round ends, the label's own figures (tub, triangle, square,
 * iron, circle) so a glance at the real label matches.
 */

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Icon({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={label} className={cx('size-9 shrink-0', className)} {...STROKE}>
      <title>{label}</title>
      {children}
    </svg>
  );
}

const Cross = () => <path d="M5 5 27 27M27 5 5 27" />;
const Dots = ({ n, y, cx: x = 16 }: { n: number; y: number; cx?: number }) => (
  <g fill="currentColor" stroke="none">
    {Array.from({ length: n }, (_, i) => (
      <circle key={i} cx={x + (i - (n - 1) / 2) * 4.2} cy={y} r={1.35} />
    ))}
  </g>
);
const Bars = ({ n, y = 28.5 }: { n: number; y?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <path key={i} d={`M7 ${y + i * 2.4}h18`} />
    ))}
  </>
);

export function WashIcon({ care, label }: { care: NonNullable<Care['wash']>; label: string }) {
  const gentle = care.gentle ?? 0;
  const bottom = 23 - gentle * 1.6;
  return (
    <Icon label={label}>
      <path d={`M4.5 10.5c2.4 2 4.8 2 7.2 0s4.8-2 7.2 0 4.8 2 7.2 0`} />
      <path d={`M5.6 13 8.4 ${bottom}h15.2l2.8-10`} />
      {care.method === 'machine' && care.temp ? (
        <text x="16" y={bottom - 2.6} textAnchor="middle" fontSize="7.2" fontWeight="700" fill="currentColor" stroke="none">
          {care.temp}
        </text>
      ) : null}
      {care.method === 'hand' ? (
        <path d="M13 21v-4.6a1.1 1.1 0 0 1 2.2 0V19v-4.2a1.1 1.1 0 0 1 2.2 0V19v-3.6a1.1 1.1 0 0 1 2.2 0v3.2c0 1.4-.9 2.4-2.4 2.4h-2.1c-1.2 0-2.1-.6-2.1-1.6" strokeWidth="1.3" />
      ) : null}
      {gentle ? <Bars n={gentle} y={bottom + 3} /> : null}
      {care.method === 'none' ? <Cross /> : null}
    </Icon>
  );
}

export function BleachIcon({ value, label }: { value: NonNullable<Care['bleach']>; label: string }) {
  return (
    <Icon label={label}>
      <path d="M16 5 28 26H4z" />
      {value === 'non_chlorine' ? <path d="M13.2 23.5 18 15.2M16.6 23.5l4.8-8.3" /> : null}
      {value === 'none' ? <Cross /> : null}
    </Icon>
  );
}

export function TumbleIcon({ value, label }: { value: NonNullable<Care['tumble']>; label: string }) {
  return (
    <Icon label={label}>
      <rect x="5" y="5" width="22" height="22" rx="2.5" />
      <circle cx="16" cy="16" r="7.5" />
      {value === 'low' ? <Dots n={1} y={16} /> : null}
      {value === 'normal' ? <Dots n={2} y={16} /> : null}
      {value === 'none' ? <Cross /> : null}
    </Icon>
  );
}

export function DryIcon({ value, label }: { value: 'line' | 'drip' | 'flat' | 'shade'; label: string }) {
  return (
    <Icon label={label}>
      <rect x="5" y="5" width="22" height="22" rx="2.5" />
      {value === 'line' ? <path d="M9 9.5c4.4 4.4 9.6 4.4 14 0" /> : null}
      {value === 'drip' ? <path d="M11.5 10v12M16 10v12M20.5 10v12" /> : null}
      {value === 'flat' ? <path d="M9.5 16h13" /> : null}
      {value === 'shade' ? <path d="M5.5 12 12 5.5M5.5 17 17 5.5" /> : null}
    </Icon>
  );
}

export function IronIcon({ value, steam, label }: { value: NonNullable<Care['iron']>; steam?: boolean; label: string }) {
  const dots = value === 'low' ? 1 : value === 'medium' ? 2 : value === 'high' ? 3 : 0;
  return (
    <Icon label={label}>
      <path d="M4 23h23c0-6.6-3.6-11-10.4-11H10.6c-1.5 0-2.8 1-3.2 2.4z" />
      <path d="M10.5 12V8.5h10" />
      {dots ? <Dots n={dots} y={18.6} cx={17} /> : null}
      {steam === false ? <path d="M9 26.5l3.5 3M14 26.5l-3.5 3M17 26.5l3.5 3M22 26.5l-3.5 3" strokeWidth="1.3" /> : null}
      {value === 'none' ? <Cross /> : null}
    </Icon>
  );
}

export function ProfessionalIcon({ value, gentle, label }: { value: 'P' | 'F' | 'W' | 'none'; gentle?: boolean; label: string }) {
  return (
    <Icon label={label}>
      <circle cx="16" cy="15" r="10" />
      {value !== 'none' ? (
        <text x="16" y="18.6" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="currentColor" stroke="none">
          {value}
        </text>
      ) : null}
      {gentle ? <path d="M8 28.5h16" /> : null}
      {value === 'none' ? <Cross /> : null}
    </Icon>
  );
}

/** The symbols and their meanings, in the label's order. */
export function CareSymbols({ care, className }: { care: Care; className?: string }) {
  const t = useClosetT();
  const rows: { key: string; icon: ReactNode; text: string }[] = [];
  if (care.wash) {
    const base =
      care.wash.method === 'machine'
        ? t.careWash.machine(care.wash.temp)
        : care.wash.method === 'hand'
          ? t.careWash.hand
          : t.careWash.none;
    const gentle = care.wash.gentle === 1 ? t.careWash.gentle1 : care.wash.gentle === 2 ? t.careWash.gentle2 : '';
    const text = gentle && care.wash.method !== 'none' ? `${base}, ${gentle}` : base;
    rows.push({ key: 'wash', icon: <WashIcon care={care.wash} label={text} />, text });
  }
  if (care.bleach) rows.push({ key: 'bleach', icon: <BleachIcon value={care.bleach} label={t.careBleach[care.bleach]} />, text: t.careBleach[care.bleach] });
  if (care.tumble) rows.push({ key: 'tumble', icon: <TumbleIcon value={care.tumble} label={t.careTumble[care.tumble]} />, text: t.careTumble[care.tumble] });
  for (const dry of care.dry ?? []) rows.push({ key: `dry-${dry}`, icon: <DryIcon value={dry} label={t.careDry[dry]} />, text: t.careDry[dry] });
  if (care.iron) {
    const text = care.steam === false && care.iron !== 'none' ? `${t.careIron[care.iron]} · ${t.careNoSteam}` : t.careIron[care.iron];
    rows.push({ key: 'iron', icon: <IronIcon value={care.iron} steam={care.steam} label={text} />, text });
  }
  if (care.professional) {
    const p = care.professional;
    const text = p.gentle && p.method !== 'none' ? `${t.careProfessional[p.method]}, ${t.careProfessional.gentle}` : t.careProfessional[p.method];
    rows.push({ key: 'pro', icon: <ProfessionalIcon value={p.method} gentle={p.gentle} label={text} />, text });
  }
  if (!rows.length) return null;
  return (
    <div className={className}>
      <div aria-hidden="true" className="flex flex-wrap gap-2 text-ink-900">
        {rows.map((row) => (
          <span key={row.key} className="grid size-12 place-items-center rounded-2xl bg-ink-50">
            {row.icon}
          </span>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start gap-2.5 text-sm leading-snug text-ink-700">
            <span aria-hidden="true" className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-ink-300" />
            {row.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
