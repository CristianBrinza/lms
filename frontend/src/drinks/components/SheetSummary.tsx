import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import type { BeerSheet, SpiritSheet, TastingSheet, WineSheet } from '../api';
import { AROMA_GROUPS, BEER_PARTS, SPIRIT_SCALES, SWATCH, WINE_SCALES } from '../catalog';
import { useDrinksT } from '../i18n';

/**
 * A tasting sheet read back: the verdict first, then structure as levels (a row of marks filled
 * to the level), aromas as chips coloured by where they come from. Only what was noted shows.
 */
export function SheetSummary({ sheet }: { sheet: TastingSheet }) {
  if (sheet.kind === 'beer') return <BeerSummary sheet={sheet} />;
  if (sheet.kind === 'spirit') return <SpiritSummary sheet={sheet} />;
  return <WineSummary sheet={sheet} />;
}

const QUALITY_TONE: Record<string, string> = {
  outstanding: 'bg-butter-300 text-ink-900',
  'very-good': 'bg-mint-200 text-mint-800',
  good: 'bg-mint-100 text-mint-800',
  acceptable: 'bg-ink-100 text-ink-700',
  poor: 'bg-danger-100 text-danger-700',
  faulty: 'bg-danger-100 text-danger-700',
};

function Verdict({
  quality,
  readiness,
  blic,
}: {
  quality?: string;
  readiness?: string;
  blic?: string[];
}) {
  const t = useDrinksT();
  if (!quality && !readiness && !blic?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {quality ? (
        <span
          className={cx(
            'inline-flex h-8 items-center rounded-pill px-3 text-sm font-bold',
            QUALITY_TONE[quality] ?? 'bg-ink-100',
          )}
        >
          {t.scale[quality] ?? quality}
        </span>
      ) : null}
      {blic?.map((key) => (
        <span
          key={key}
          className="inline-flex h-6 items-center rounded-pill bg-mint-100 px-2 text-xs font-semibold text-mint-800"
        >
          {t.blic[key as keyof typeof t.blic]}
        </span>
      ))}
      {readiness ? (
        <span className="w-full text-sm text-ink-600">{t.scale[readiness] ?? readiness}</span>
      ) : null}
    </div>
  );
}

/** One structural component: its name, the level as filled marks, the word. */
function Level({ label, scale, value }: { label: string; scale: string[]; value?: string }) {
  const t = useDrinksT();
  if (!value) return null;
  const at = scale.indexOf(value);
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="truncate text-sm text-ink-600">{label}</dt>
      <dd className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex flex-1 gap-0.5">
          {scale.map((step, index) => (
            <span
              key={step}
              className={cx(
                'h-2 flex-1 first:rounded-l-pill last:rounded-r-pill',
                index <= at ? 'bg-ink-900' : 'bg-ink-100',
              )}
            />
          ))}
        </span>
        <span className="w-28 shrink-0 truncate text-sm font-semibold">{t.scale[value] ?? value}</span>
      </dd>
    </div>
  );
}

const STAGE_TONE = {
  primary: 'bg-pink-100 text-pink-800',
  secondary: 'bg-butter-100 text-butter-800',
  tertiary: 'bg-peach-100 text-peach-800',
} as const;

function Aromas({ ids, kind, label }: { ids?: string[]; kind: 'wine' | 'spirit' | 'beer'; label: string }) {
  const t = useDrinksT();
  if (!ids?.length) return null;
  const stageOf = new Map(
    AROMA_GROUPS[kind].flatMap((group) => group.aromas.map((id) => [id, group.stage] as const)),
  );
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink-500">{label}</p>
      <ul className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const stage = stageOf.get(id);
          return (
            <li
              key={id}
              className={cx(
                'rounded-pill px-2.5 py-1 text-[0.8125rem] font-semibold',
                stage ? STAGE_TONE[stage] : 'bg-pink-100 text-pink-800',
              )}
            >
              {t.aroma[id] ?? id}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-400">{title}</p>
      {children}
    </div>
  );
}

/** "Clear · Deep · Garnet", with the colour as a swatch. */
function Look({ words, colour }: { words: (string | undefined)[]; colour?: string }) {
  const t = useDrinksT();
  const shown = words.filter((w): w is string => Boolean(w)).map((w) => t.scale[w] ?? w);
  if (!shown.length && !colour) return null;
  return (
    <p className="flex items-center gap-2 text-[0.9375rem] font-medium text-ink-800">
      {colour && SWATCH[colour] ? (
        <span
          aria-hidden="true"
          className="size-5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ background: SWATCH[colour] }}
        />
      ) : null}
      {[...shown, colour ? (t.scale[colour] ?? colour) : null].filter(Boolean).join(' · ')}
    </p>
  );
}

function WineSummary({ sheet }: { sheet: WineSheet }) {
  const t = useDrinksT();
  const { appearance: a, nose: n, palate: p, conclusions: c } = sheet;
  const blic = (['balance', 'length', 'intensity', 'complexity'] as const).filter((k) => c?.[k]);
  return (
    <div className="flex flex-col gap-3">
      <Verdict quality={c?.quality} readiness={c?.readiness} blic={blic} />
      {a ? (
        <Block title={t.section.appearance}>
          <Look words={[a.clarity, a.intensity, ...(a.other ?? [])]} colour={a.colour} />
        </Block>
      ) : null}
      {n ? (
        <Block title={t.section.nose}>
          <dl className="flex flex-col gap-2">
            <Level label={t.field.intensity} scale={WINE_SCALES.noseIntensity} value={n.intensity} />
          </dl>
          <Look words={[n.condition, n.development]} />
          <Aromas ids={n.aromas} kind="wine" label={t.field.aromas} />
        </Block>
      ) : null}
      {p ? (
        <Block title={t.section.palate}>
          <dl className="flex flex-col gap-2">
            <Level label={t.field.sweetness} scale={WINE_SCALES.sweetness} value={p.sweetness} />
            <Level label={t.field.acidity} scale={WINE_SCALES.acidity} value={p.acidity} />
            <Level label={t.field.tannin} scale={WINE_SCALES.tannin} value={p.tannin} />
            <Level label={t.field.alcohol} scale={WINE_SCALES.alcohol} value={p.alcohol} />
            <Level label={t.field.body} scale={WINE_SCALES.body} value={p.body} />
            <Level label={t.field.mousse} scale={WINE_SCALES.mousse} value={p.mousse} />
            <Level label={t.field.flavourIntensity} scale={WINE_SCALES.flavourIntensity} value={p.intensity} />
            <Level label={t.field.finish} scale={WINE_SCALES.finish} value={p.finish} />
          </dl>
          <Aromas ids={p.flavours} kind="wine" label={t.field.flavours} />
        </Block>
      ) : null}
    </div>
  );
}

function SpiritSummary({ sheet }: { sheet: SpiritSheet }) {
  const t = useDrinksT();
  const { appearance: a, nose: n, palate: p, conclusions: c } = sheet;
  return (
    <div className="flex flex-col gap-3">
      <Verdict quality={c?.quality} />
      {a ? (
        <Block title={t.section.appearance}>
          <Look words={[a.intensity]} colour={a.colour} />
        </Block>
      ) : null}
      {n ? (
        <Block title={t.section.nose}>
          <dl className="flex flex-col gap-2">
            <Level label={t.field.intensity} scale={SPIRIT_SCALES.noseIntensity} value={n.intensity} />
          </dl>
          <Aromas ids={n.aromas} kind="spirit" label={t.field.aromas} />
        </Block>
      ) : null}
      {p ? (
        <Block title={t.section.palate}>
          <dl className="flex flex-col gap-2">
            <Level label={t.field.sweetness} scale={SPIRIT_SCALES.sweetness} value={p.sweetness} />
            <Level label={t.field.finish} scale={SPIRIT_SCALES.finish} value={p.finish} />
            <Level label={t.field.complexity} scale={SPIRIT_SCALES.complexity} value={p.complexity} />
          </dl>
          {p.texture?.length ? (
            <p className="text-[0.9375rem] font-medium text-ink-800">
              {p.texture.map((x) => t.scale[x] ?? x).join(' · ')}
            </p>
          ) : null}
          <Aromas ids={p.flavours} kind="spirit" label={t.field.flavours} />
        </Block>
      ) : null}
    </div>
  );
}

function BeerSummary({ sheet }: { sheet: BeerSheet }) {
  const t = useDrinksT();
  const scores = sheet.scores ?? {};
  const scored = BEER_PARTS.filter((part) => scores[part.id] !== undefined);
  const total = scored.reduce((sum, part) => sum + (scores[part.id] ?? 0), 0);
  return (
    <div className="flex flex-col gap-3">
      {scored.length ? (
        <div className="flex flex-col gap-2.5">
          <p className="flex items-baseline gap-1.5">
            <span className="tabular text-[2rem] font-bold leading-none tracking-[-0.04em]">
              {total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
            <span className="text-sm font-semibold text-ink-500">{t.outOf(50)}</span>
          </p>
          <dl className="flex flex-col gap-2">
            {scored.map((part) => (
              <div key={part.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3rem] items-center gap-3">
                <dt className="truncate text-sm text-ink-600">{t.beerPart[part.id]}</dt>
                <dd aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-ink-100">
                  <span
                    className="block h-full rounded-pill bg-ink-900"
                    style={{ width: `${((scores[part.id] ?? 0) / part.max) * 100}%` }}
                  />
                </dd>
                <dd className="tabular text-right text-sm font-semibold">
                  {scores[part.id]}
                  <span className="text-ink-400">/{part.max}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <Aromas ids={sheet.aromas} kind="beer" label={t.field.aromas} />
      {sheet.offFlavours?.length ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-500">{t.section.offFlavours}</p>
          <ul className="flex flex-wrap gap-1">
            {sheet.offFlavours.map((id) => (
              <li
                key={id}
                className="rounded-pill bg-danger-50 px-2.5 py-1 text-[0.8125rem] font-semibold text-danger-700"
              >
                {t.offFlavour[id] ?? id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
