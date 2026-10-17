import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { useUser } from '@/app/auth';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { DeleteIcon } from '@/components/ui/icons';
import { localDate } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import {
  drinksApi,
  drinksKeys,
  sheetKind,
  type BeerScores,
  type BeerSheet,
  type Drink,
  type DrinkPerson,
  type SheetKind,
  type SpiritSheet,
  type Tasting,
  type TastingFields,
  type TastingSheet as Sheet_,
  type WineSheet,
} from '../api';
import {
  AROMA_GROUPS,
  BEER_OFF_FLAVOURS,
  BEER_PARTS,
  QUICK_AROMAS,
  SPIRIT_SCALES,
  SWATCH,
  WINE_COLOURS,
  WINE_SCALES,
  type AromaGroup,
} from '../catalog';
import { countryOptions, parseNumber } from '../format';
import { useDrinksT } from '../i18n';
import { Area } from './DrinkSheet';
import { ChipSet, RatingPicker, ScalePicker, Segmented } from './parts';

/**
 * Logs a tasting, or edits one. Quick: the stars, a few words, a few aromas. Full: WSET's
 * Systematic Approach to Tasting for wine and spirits, BJCP's score sheet for beer, step by step.
 */
export function TastingSheet({
  open,
  onClose,
  drink,
  people,
  tasting,
}: {
  open: boolean;
  onClose: () => void;
  drink: Drink;
  people: DrinkPerson[];
  tasting?: Tasting | null;
}) {
  const t = useDrinksT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tasting ? t.editTasting : t.tastingTitle}
      description={drink.name}
      size="lg"
    >
      {open ? (
        <Form
          key={tasting?.id ?? 'new'}
          drink={drink}
          people={people}
          tasting={tasting ?? null}
          onDone={onClose}
        />
      ) : null}
    </Sheet>
  );
}

const empty = (kind: SheetKind): Sheet_ => ({ v: 1, kind }) as Sheet_;

/** Drops empty parts, so a sheet holds only what was noted; nothing noted → no sheet. */
function prune(sheet: Sheet_): Sheet_ | null {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.length ? value : undefined;
    if (value && typeof value === 'object') {
      const entries = Object.entries(value)
        .map(([key, inner]) => [key, clean(inner)] as const)
        .filter(([, inner]) => inner !== undefined && inner !== false);
      return entries.length ? Object.fromEntries(entries) : undefined;
    }
    return value === '' ? undefined : value;
  };
  const { v, kind, ...rest } = sheet;
  const body = clean(rest) as object | undefined;
  return body ? ({ v, kind, ...body } as Sheet_) : null;
}

/** The aromas a sheet holds, wherever its kind keeps them. */
const aromasOf = (sheet: Sheet_) =>
  sheet.kind === 'beer' ? (sheet.aromas ?? []) : (sheet.nose?.aromas ?? []);
const withAromas = (sheet: Sheet_, aromas: string[]): Sheet_ =>
  sheet.kind === 'beer'
    ? { ...sheet, aromas }
    : ({ ...sheet, nose: { ...sheet.nose, aromas } } as Sheet_);

function Form({
  drink,
  people,
  tasting,
  onDone,
}: {
  drink: Drink;
  people: DrinkPerson[];
  tasting: Tasting | null;
  onDone: () => void;
}) {
  const t = useDrinksT();
  const me = useUser();
  const client = useQueryClient();
  const kind = sheetKind(drink.category);
  const [mode, setMode] = useState<'quick' | 'full'>(tasting?.mode ?? 'quick');
  const [personId, setPersonId] = useState(tasting?.person.id ?? me.id);
  const [tastedOn, setTastedOn] = useState(tasting?.tastedOn ?? localDate());
  const [place, setPlace] = useState(tasting?.place ?? '');
  const [occasion, setOccasion] = useState(tasting?.occasion ?? '');
  const [country, setCountry] = useState(tasting?.country ?? '');
  const [withPeople, setWithPeople] = useState<string[]>(tasting?.withPeople ?? []);
  const [withOthers, setWithOthers] = useState(tasting?.withOthers ?? '');
  const [rating, setRating] = useState<number | null>(tasting?.rating ?? null);
  const [score, setScore] = useState(tasting?.score !== null && tasting?.score !== undefined ? String(tasting.score) : '');
  const [buyAgain, setBuyAgain] = useState<boolean | null>(tasting?.buyAgain ?? null);
  const [comment, setComment] = useState(tasting?.comment ?? '');
  const [pairing, setPairing] = useState(tasting?.pairing ?? '');
  const [sheet, setSheet] = useState<Sheet_>(
    tasting?.sheet && tasting.sheet.kind === kind ? tasting.sheet : empty(kind),
  );
  const countries = useMemo(() => countryOptions(), []);

  const scoreValue = parseNumber(score);
  const scoreOk = !score.trim() || (scoreValue !== null && scoreValue >= 0 && scoreValue <= 100);

  const fields = (): TastingFields => ({
    tastedOn,
    place: place.trim(),
    occasion: occasion.trim(),
    country,
    withPeople: withPeople.filter((id) => id !== personId),
    withOthers: withOthers.trim(),
    rating,
    score: scoreValue === null ? null : Math.round(scoreValue),
    buyAgain,
    comment: comment.trim(),
    pairing: pairing.trim(),
    mode,
    sheet: prune(sheet),
    ...(tasting ? {} : { personId }),
  });

  const refresh = () => client.invalidateQueries({ queryKey: drinksKeys.all });
  const save = useMutation({
    mutationFn: () =>
      tasting ? drinksApi.updateTasting(tasting.id, fields()) : drinksApi.addTasting(drink.id, fields()),
    onSuccess: () => {
      haptic('success');
      toast.success(t.tastingSaved);
      onDone();
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: () => drinksApi.removeTasting(tasting!.id),
    onSuccess: () => {
      toast.success(t.tastingDeleted);
      onDone();
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: refresh,
  });

  const others = people.filter((p) => p.id !== personId);
  const canChooseWhose = !tasting && people.length > 1;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (scoreOk && !save.isPending) save.mutate();
      }}
    >
      <Segmented
        label={t.modeLabel}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'quick', label: t.quick },
          { value: 'full', label: t.full },
        ]}
      />

      <div className="flex flex-col items-center gap-1 rounded-[1.5rem] bg-butter-50 px-3 py-4">
        <span className="text-[0.8125rem] font-semibold text-butter-800">{t.ratingLabel}</span>
        <RatingPicker value={rating} onChange={setRating} label={t.ratingLabel} size="lg" />
      </div>

      <Area
        label={t.comment}
        value={comment}
        onChange={setComment}
        placeholder={t.commentPlaceholder}
        rows={3}
      />

      {mode === 'quick' ? (
        <div>
          <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.aromasQuick}</p>
          <ChipSet
            label={t.aromasQuick}
            options={[...new Set([...QUICK_AROMAS[kind], ...aromasOf(sheet)])]}
            values={aromasOf(sheet)}
            onChange={(aromas) => setSheet(withAromas(sheet, aromas))}
            word={(id) => t.aroma[id] ?? id}
            tone="pink"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <TextField
          label={t.when}
          type="date"
          value={tastedOn}
          max={localDate()}
          onChange={(e) => setTastedOn(e.target.value)}
        />
        <TextField
          label={t.place}
          placeholder={t.placePlaceholder}
          value={place}
          maxLength={160}
          onChange={(e) => setPlace(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.buyAgain}</p>
        <Segmented
          label={t.buyAgain}
          value={buyAgain === null ? 'unsure' : buyAgain ? 'yes' : 'no'}
          onChange={(value) => setBuyAgain(value === 'unsure' ? null : value === 'yes')}
          options={[
            { value: 'yes', label: t.yes },
            { value: 'no', label: t.no },
            { value: 'unsure', label: t.notSure },
          ]}
        />
      </div>

      {mode === 'full' ? (
        <>
          {canChooseWhose ? (
            <div>
              <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.whose}</p>
              <Segmented
                label={t.whose}
                value={personId}
                onChange={setPersonId}
                options={people.map((p) => ({ value: p.id, label: p.id === me.id ? t.you : p.name }))}
              />
            </div>
          ) : null}
          {others.length ? (
            <div>
              <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.withWhom}</p>
              <ChipSet
                label={t.withWhom}
                options={others.map((p) => p.id)}
                values={withPeople}
                onChange={setWithPeople}
                word={(id) => others.find((p) => p.id === id)?.name ?? id}
              />
            </div>
          ) : null}
          <TextField
            label={t.withOthers}
            placeholder={t.withOthersPlaceholder}
            value={withOthers}
            maxLength={300}
            onChange={(e) => setWithOthers(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <TextField
              label={t.occasion}
              placeholder={t.occasionPlaceholder}
              value={occasion}
              maxLength={160}
              onChange={(e) => setOccasion(e.target.value)}
            />
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink-700">{t.tastedIn}</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-14 w-full appearance-none rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none hover:bg-ink-100 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
              >
                <option value="">{t.pickCountry}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <TextField
              label={t.score}
              inputMode="numeric"
              placeholder="90"
              hint={t.scoreHint}
              value={score}
              maxLength={3}
              error={scoreOk ? undefined : '0–100'}
              onChange={(e) => setScore(e.target.value.replace(/\D/g, ''))}
            />
            <TextField
              label={t.pairing}
              placeholder={t.pairingPlaceholder}
              value={pairing}
              maxLength={300}
              onChange={(e) => setPairing(e.target.value)}
            />
          </div>

          {sheet.kind === 'wine' ? (
            <WineForm sheet={sheet} onChange={setSheet} drink={drink} />
          ) : sheet.kind === 'spirit' ? (
            <SpiritForm sheet={sheet} onChange={setSheet} />
          ) : (
            <BeerForm sheet={sheet} onChange={setSheet} />
          )}
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!scoreOk}>
          {t.save}
        </Button>
        {tasting ? (
          <Button
            variant="ghost"
            icon={DeleteIcon}
            className="self-center text-danger-700"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {t.deleteTasting}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Part({ title, step, children }: { title: string; step: number; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-[1.5rem] bg-ink-50 p-4">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden="true" className="flex items-baseline gap-2">
        <span className="tabular text-[1.375rem] font-bold leading-none tracking-[-0.03em] text-ink-300">
          {String(step).padStart(2, '0')}
        </span>
        <span className="text-[1.0625rem] font-bold">{title}</span>
      </p>
      {children}
    </fieldset>
  );
}

/** Aroma chips by group; on wine, the groups sit under primary, secondary and tertiary. */
function AromaPicker({
  groups,
  values,
  onChange,
  label,
}: {
  groups: AromaGroup[];
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
}) {
  const t = useDrinksT();
  const tone = { primary: 'pink', secondary: 'butter', tertiary: 'peach' } as const;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold text-ink-700">
        {label}
        {values.length ? <span className="tabular ml-1.5 text-ink-500">{values.length}</span> : null}
      </span>
      {groups.map((group, index) => {
        // A stage's heading over its first group.
        const heading =
          group.stage && group.stage !== groups[index - 1]?.stage ? group.stage : null;
        return (
          <div key={group.id}>
            {heading ? (
              <p className="mb-2 mt-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-500">
                {t.stage[heading]}
              </p>
            ) : null}
            <p className="mb-1.5 text-xs font-semibold text-ink-600">{t.aromaGroup[group.id] ?? group.id}</p>
            <ChipSet
              label={t.aromaGroup[group.id] ?? group.id}
              options={group.aromas}
              values={values}
              onChange={(next) => onChange(next)}
              word={(id) => t.aroma[id] ?? id}
              tone={group.stage ? tone[group.stage] : 'pink'}
            />
          </div>
        );
      })}
      {(() => {
        // Words the chips don't have (written by Claude) stay listed, so they can be removed.
        const known = new Set(groups.flatMap((g) => g.aromas));
        const extra = values.filter((v) => !known.has(v));
        return extra.length ? (
          <ChipSet
            label={label}
            options={extra}
            values={values}
            onChange={onChange}
            word={(id) => t.aroma[id] ?? id}
          />
        ) : null;
      })()}
    </div>
  );
}

function WineForm({
  sheet,
  onChange,
  drink,
}: {
  sheet: WineSheet;
  onChange: (sheet: WineSheet) => void;
  drink: Drink;
}) {
  const t = useDrinksT();
  const set = <S extends 'appearance' | 'nose' | 'palate' | 'conclusions'>(
    section: S,
    patch: Partial<NonNullable<WineSheet[S]>>,
  ) => onChange({ ...sheet, [section]: { ...sheet[section], ...patch } });
  const colours = drink.color
    ? WINE_COLOURS[drink.color]
    : [...new Set(Object.values(WINE_COLOURS).flat())];
  const showTannin = drink.color !== 'white';
  const sparkling = drink.category === 'sparkling';
  return (
    <>
      <Part title={t.section.appearance} step={1}>
        <ScalePicker
          label={t.field.clarity}
          options={WINE_SCALES.clarity}
          value={sheet.appearance?.clarity}
          onChange={(clarity) => set('appearance', { clarity })}
        />
        <ScalePicker
          label={t.field.intensity}
          options={WINE_SCALES.appearanceIntensity}
          value={sheet.appearance?.intensity}
          onChange={(intensity) => set('appearance', { intensity })}
          ordinal
        />
        <ScalePicker
          label={t.field.colour}
          options={colours}
          value={sheet.appearance?.colour}
          onChange={(colour) => set('appearance', { colour })}
          swatches={SWATCH}
        />
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-700">{t.field.other}</p>
          <ChipSet
            label={t.field.other}
            options={WINE_SCALES.appearanceOther}
            values={sheet.appearance?.other ?? []}
            onChange={(other) => set('appearance', { other })}
            word={(id) => t.scale[id] ?? id}
          />
        </div>
      </Part>
      <Part title={t.section.nose} step={2}>
        <ScalePicker
          label={t.field.condition}
          options={WINE_SCALES.condition}
          value={sheet.nose?.condition}
          onChange={(condition) => set('nose', { condition })}
        />
        <ScalePicker
          label={t.field.intensity}
          options={WINE_SCALES.noseIntensity}
          value={sheet.nose?.intensity}
          onChange={(intensity) => set('nose', { intensity })}
          ordinal
        />
        <AromaPicker
          label={t.field.aromas}
          groups={AROMA_GROUPS.wine}
          values={sheet.nose?.aromas ?? []}
          onChange={(aromas) => set('nose', { aromas })}
        />
        <ScalePicker
          label={t.field.development}
          options={WINE_SCALES.development}
          value={sheet.nose?.development}
          onChange={(development) => set('nose', { development })}
        />
      </Part>
      <Part title={t.section.palate} step={3}>
        <ScalePicker
          label={t.field.sweetness}
          options={WINE_SCALES.sweetness}
          value={sheet.palate?.sweetness}
          onChange={(sweetness) => set('palate', { sweetness })}
          ordinal
        />
        <ScalePicker
          label={t.field.acidity}
          options={WINE_SCALES.acidity}
          value={sheet.palate?.acidity}
          onChange={(acidity) => set('palate', { acidity })}
          ordinal
        />
        {showTannin ? (
          <ScalePicker
            label={t.field.tannin}
            options={WINE_SCALES.tannin}
            value={sheet.palate?.tannin}
            onChange={(tannin) => set('palate', { tannin })}
            ordinal
          />
        ) : null}
        <ScalePicker
          label={t.field.alcohol}
          options={WINE_SCALES.alcohol}
          value={sheet.palate?.alcohol}
          onChange={(alcohol) => set('palate', { alcohol })}
          ordinal
        />
        <ScalePicker
          label={t.field.body}
          options={WINE_SCALES.body}
          value={sheet.palate?.body}
          onChange={(body) => set('palate', { body })}
          ordinal
        />
        {sparkling ? (
          <ScalePicker
            label={t.field.mousse}
            options={WINE_SCALES.mousse}
            value={sheet.palate?.mousse}
            onChange={(mousse) => set('palate', { mousse })}
          />
        ) : null}
        <ScalePicker
          label={t.field.flavourIntensity}
          options={WINE_SCALES.flavourIntensity}
          value={sheet.palate?.intensity}
          onChange={(intensity) => set('palate', { intensity })}
          ordinal
        />
        <FlavourPicker
          groups={AROMA_GROUPS.wine}
          values={sheet.palate?.flavours ?? []}
          nose={sheet.nose?.aromas ?? []}
          onChange={(flavours) => set('palate', { flavours })}
        />
        <ScalePicker
          label={t.field.finish}
          options={WINE_SCALES.finish}
          value={sheet.palate?.finish}
          onChange={(finish) => set('palate', { finish })}
          ordinal
        />
      </Part>
      <Part title={t.section.conclusions} step={4}>
        <ScalePicker
          label={t.field.quality}
          options={WINE_SCALES.quality}
          value={sheet.conclusions?.quality}
          onChange={(quality) => set('conclusions', { quality })}
        />
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-700">{t.field.blic}</p>
          <ChipSet
            label={t.field.blic}
            options={['balance', 'length', 'intensity', 'complexity']}
            values={(['balance', 'length', 'intensity', 'complexity'] as const).filter(
              (key) => sheet.conclusions?.[key],
            )}
            onChange={(on) =>
              set('conclusions', {
                balance: on.includes('balance'),
                length: on.includes('length'),
                intensity: on.includes('intensity'),
                complexity: on.includes('complexity'),
              })
            }
            word={(id) => t.blic[id as keyof typeof t.blic]}
            tone="mint"
          />
        </div>
        <ScalePicker
          label={t.field.readiness}
          options={WINE_SCALES.readiness}
          value={sheet.conclusions?.readiness}
          onChange={(readiness) => set('conclusions', { readiness })}
        />
      </Part>
    </>
  );
}

/** Flavours on the palate: the same chips as the nose, with one tap to copy the nose's. */
function FlavourPicker({
  groups,
  values,
  nose,
  onChange,
}: {
  groups: AromaGroup[];
  values: string[];
  nose: string[];
  onChange: (values: string[]) => void;
}) {
  const t = useDrinksT();
  const [open, setOpen] = useState(values.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm font-semibold text-ink-700">{t.field.flavours}</span>
        {nose.length ? (
          <button
            type="button"
            onClick={() => {
              onChange([...new Set([...values, ...nose])]);
              setOpen(true);
            }}
            className="press h-8 rounded-pill bg-white px-3 text-[0.8125rem] font-semibold text-ink-800 shadow-[var(--shadow-xs)]"
          >
            {t.sameAsNose}
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="press h-8 rounded-pill bg-white px-3 text-[0.8125rem] font-semibold text-ink-800 shadow-[var(--shadow-xs)]"
        >
          {open ? t.fewerDetails : t.moreDetails}
        </button>
      </div>
      {!open && values.length ? (
        <p className="text-sm text-ink-600">{values.map((id) => t.aroma[id] ?? id).join(', ')}</p>
      ) : null}
      {open ? (
        <AromaPicker label={t.field.flavours} groups={groups} values={values} onChange={onChange} />
      ) : null}
    </div>
  );
}

function SpiritForm({ sheet, onChange }: { sheet: SpiritSheet; onChange: (sheet: SpiritSheet) => void }) {
  const t = useDrinksT();
  const set = <S extends 'appearance' | 'nose' | 'palate' | 'conclusions'>(
    section: S,
    patch: Partial<NonNullable<SpiritSheet[S]>>,
  ) => onChange({ ...sheet, [section]: { ...sheet[section], ...patch } });
  return (
    <>
      <Part title={t.section.appearance} step={1}>
        <ScalePicker
          label={t.field.intensity}
          options={SPIRIT_SCALES.appearanceIntensity}
          value={sheet.appearance?.intensity}
          onChange={(intensity) => set('appearance', { intensity })}
          swatches={SWATCH}
        />
        <ScalePicker
          label={t.field.colour}
          options={SPIRIT_SCALES.colour}
          value={sheet.appearance?.colour}
          onChange={(colour) => set('appearance', { colour })}
          swatches={SWATCH}
        />
      </Part>
      <Part title={t.section.nose} step={2}>
        <ScalePicker
          label={t.field.intensity}
          options={SPIRIT_SCALES.noseIntensity}
          value={sheet.nose?.intensity}
          onChange={(intensity) => set('nose', { intensity })}
          ordinal
        />
        <AromaPicker
          label={t.field.aromas}
          groups={AROMA_GROUPS.spirit}
          values={sheet.nose?.aromas ?? []}
          onChange={(aromas) => set('nose', { aromas })}
        />
      </Part>
      <Part title={t.section.palate} step={3}>
        <ScalePicker
          label={t.field.sweetness}
          options={SPIRIT_SCALES.sweetness}
          value={sheet.palate?.sweetness}
          onChange={(sweetness) => set('palate', { sweetness })}
          ordinal
        />
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-700">{t.field.texture}</p>
          <ChipSet
            label={t.field.texture}
            options={SPIRIT_SCALES.texture}
            values={sheet.palate?.texture ?? []}
            onChange={(texture) => set('palate', { texture })}
            word={(id) => t.scale[id] ?? id}
          />
        </div>
        <FlavourPicker
          groups={AROMA_GROUPS.spirit}
          values={sheet.palate?.flavours ?? []}
          nose={sheet.nose?.aromas ?? []}
          onChange={(flavours) => set('palate', { flavours })}
        />
        <ScalePicker
          label={t.field.finish}
          options={SPIRIT_SCALES.finish}
          value={sheet.palate?.finish}
          onChange={(finish) => set('palate', { finish })}
          ordinal
        />
        <ScalePicker
          label={t.field.complexity}
          options={SPIRIT_SCALES.complexity}
          value={sheet.palate?.complexity}
          onChange={(complexity) => set('palate', { complexity })}
          ordinal
        />
      </Part>
      <Part title={t.section.conclusions} step={4}>
        <ScalePicker
          label={t.field.quality}
          options={SPIRIT_SCALES.quality}
          value={sheet.conclusions?.quality}
          onChange={(quality) => set('conclusions', { quality })}
        />
      </Part>
    </>
  );
}

/** BJCP's five parts as sliders in half points, and the total out of 50. */
function BeerForm({ sheet, onChange }: { sheet: BeerSheet; onChange: (sheet: BeerSheet) => void }) {
  const t = useDrinksT();
  const scores = sheet.scores ?? {};
  const total = BEER_PARTS.reduce((sum, part) => sum + (scores[part.id] ?? 0), 0);
  const setScore = (id: keyof BeerScores, value: number | undefined) =>
    onChange({ ...sheet, scores: { ...scores, [id]: value } });
  return (
    <>
      <Part title={t.section.beer} step={1}>
        <p className="flex items-baseline gap-1.5">
          <span className="tabular text-[2.25rem] font-bold leading-none tracking-[-0.04em]">
            {total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </span>
          <span className="text-sm font-semibold text-ink-500">{t.outOf(50)}</span>
        </p>
        {BEER_PARTS.map((part) => {
          const value = scores[part.id];
          return (
            <label key={part.id} className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink-700">
                {t.beerPart[part.id]}
                <span className="tabular text-ink-900">
                  {value === undefined ? '—' : value}
                  <span className="text-ink-400"> / {part.max}</span>
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={part.max}
                step={0.5}
                value={value ?? 0}
                onChange={(e) => setScore(part.id, Number(e.target.value))}
                className={cx('w-full accent-ink-900', value === undefined && 'opacity-50')}
              />
            </label>
          );
        })}
      </Part>
      <Part title={t.section.nose} step={2}>
        <AromaPicker
          label={t.field.aromas}
          groups={AROMA_GROUPS.beer}
          values={sheet.aromas ?? []}
          onChange={(aromas) => onChange({ ...sheet, aromas })}
        />
      </Part>
      <Part title={t.section.offFlavours} step={3}>
        <ChipSet
          label={t.section.offFlavours}
          options={BEER_OFF_FLAVOURS}
          values={sheet.offFlavours ?? []}
          onChange={(offFlavours) => onChange({ ...sheet, offFlavours })}
          word={(id) => t.offFlavour[id] ?? id}
          tone="peach"
        />
      </Part>
    </>
  );
}
