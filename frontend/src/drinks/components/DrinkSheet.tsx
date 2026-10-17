import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { AddPhotoIcon, CloseIcon, ExpandMoreIcon, RemoveIcon, AddIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import {
  CATEGORIES,
  drinksApi,
  drinksKeys,
  sheetKind,
  type Category,
  type Drink,
  type DrinkFields,
  type PhotoKind,
  type WineColor,
} from '../api';
import { STYLE_HINTS, WINE_COLORS } from '../catalog';
import { countryOptions, parseNumber, splitList } from '../format';
import { photoForUpload, PhotoTooLarge } from '../images';
import { useDrinksT } from '../i18n';
import { Segmented } from './parts';

const CURRENCIES = ['MDL', 'EUR', 'USD', 'RON', 'GBP'] as const;

export const fieldClass =
  'w-full rounded-[1.125rem] bg-ink-50 px-4 py-3 text-base text-ink-900 outline-none transition-[background-color,box-shadow] duration-150 placeholder:text-ink-500 hover:bg-ink-100 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]';

/**
 * Adds a drink (with its label photos), edits one, or starts a new version from one. The essentials
 * first; everything a label can say behind "More details"; then what's at home.
 */
export function DrinkSheet({
  open,
  onClose,
  drink,
  from,
  tags,
  currency,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Editing this drink. */
  drink?: Drink | null;
  /** A new version of this one. */
  from?: Drink | null;
  tags: string[];
  currency: string;
  onCreated?: (drink: Drink) => void;
}) {
  const t = useDrinksT();
  const title = drink ? t.editTitle : from ? t.newVersionTitle : t.newTitle;
  return (
    <Sheet open={open} onClose={onClose} title={title} size="lg">
      {open ? (
        <Form
          key={drink?.id ?? from?.id ?? 'new'}
          drink={drink ?? null}
          from={from ?? null}
          tags={tags}
          currency={currency}
          onDone={onClose}
          onCreated={onCreated}
        />
      ) : null}
    </Sheet>
  );
}

const str = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

interface Picked {
  kind: PhotoKind;
  file: File;
  preview: string;
}

function Form({
  drink,
  from,
  tags: knownTags,
  currency: kitchenCurrency,
  onDone,
  onCreated,
}: {
  drink: Drink | null;
  from: Drink | null;
  tags: string[];
  currency: string;
  onDone: () => void;
  onCreated?: (drink: Drink) => void;
}) {
  const t = useDrinksT();
  const client = useQueryClient();
  // A new version starts from the family's facts, not this bottle's.
  const base = drink ?? from;
  const [category, setCategory] = useState<Category>(base?.category ?? 'wine');
  const [name, setName] = useState(drink?.name ?? '');
  const [producer, setProducer] = useState(base?.producer ?? '');
  const [line, setLine] = useState(base?.line ?? '');
  const [variant, setVariant] = useState(drink?.variant ?? '');
  const [vintage, setVintage] = useState(str(drink?.vintage));
  const [ageYears, setAgeYears] = useState(str(drink?.ageYears));
  const [abv, setAbv] = useState(str(base?.abv));
  const [volumeMl, setVolumeMl] = useState(str(base?.volumeMl));
  const [country, setCountry] = useState(base?.country ?? '');
  const [region, setRegion] = useState(base?.region ?? '');
  const [appellation, setAppellation] = useState(base?.appellation ?? '');
  const [grapes, setGrapes] = useState((base?.grapes ?? []).join(', '));
  const [color, setColor] = useState<WineColor | ''>(base?.color ?? '');
  const [style, setStyle] = useState(base?.style ?? '');
  const [cask, setCask] = useState(base?.cask ?? '');
  const [producedOn, setProducedOn] = useState(drink?.producedOn ?? '');
  const [labelText, setLabelText] = useState(drink?.labelText ?? '');
  const [tags, setTags] = useState((base?.tags ?? []).join(', '));
  const [notes, setNotes] = useState(drink?.notes ?? '');
  const [stock, setStock] = useState(drink?.stock ?? (from ? 0 : 1));
  const [location, setLocation] = useState(drink?.location ?? from?.location ?? '');
  const [opened, setOpened] = useState(drink?.opened ?? false);
  const [wanted, setWanted] = useState(drink?.wanted ?? false);
  const [price, setPrice] = useState(str(drink?.price));
  const [currency, setCurrency] = useState(drink?.currency ?? kitchenCurrency);
  const [boughtAt, setBoughtAt] = useState(drink?.boughtAt ?? '');
  const [boughtOn, setBoughtOn] = useState(drink?.boughtOn ?? '');
  const [more, setMore] = useState(Boolean(drink?.line || drink?.labelText || drink?.region));
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  // The previews are object URLs: let them go when the form closes.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const countries = useMemo(() => countryOptions(), []);
  const kind = sheetKind(category);
  const winey = category === 'wine' || category === 'sparkling' || category === 'fortified';
  const yearNow = new Date().getFullYear();

  const number = (value: string) => parseNumber(value);
  const intOrNull = (value: string) => {
    const n = number(value);
    return n === null ? null : Math.round(n);
  };
  const vintageOk = !vintage.trim() || ((number(vintage) ?? 0) >= 1800 && (number(vintage) ?? 0) <= yearNow + 1);
  const abvOk = !abv.trim() || ((number(abv) ?? -1) >= 0 && (number(abv) ?? 101) <= 100);
  const priceOk = !price.trim() || (number(price) ?? -1) >= 0;
  const ready = name.trim().length > 0 && vintageOk && abvOk && priceOk;

  const fields = (): DrinkFields & { category: Category; name: string } => ({
    category,
    name: name.trim(),
    producer: producer.trim(),
    line: line.trim(),
    variant: variant.trim(),
    vintage: intOrNull(vintage),
    ageYears: intOrNull(ageYears),
    abv: number(abv),
    volumeMl: intOrNull(volumeMl),
    country,
    region: region.trim(),
    appellation: appellation.trim(),
    grapes: winey ? splitList(grapes) : [],
    color: winey ? color : '',
    style: style.trim(),
    cask: cask.trim(),
    producedOn: producedOn || null,
    labelText: labelText.trim(),
    tags: splitList(tags),
    notes: notes.trim(),
    stock,
    location: location.trim(),
    opened: stock > 0 && opened,
    wanted,
    price: number(price),
    currency,
    boughtAt: boughtAt.trim(),
    boughtOn: boughtOn || null,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (drink) return (await drinksApi.update(drink.id, fields())).drink;
      const created = (await drinksApi.add({ ...fields(), ...(from ? { fromId: from.id } : {}) }))
        .drink;
      // Front first: the first photo is the cover.
      const ordered = [...photos].sort((a, b) => (a.kind === 'front' ? -1 : b.kind === 'front' ? 1 : 0));
      for (const [index, photo] of ordered.entries()) {
        setProgress(`${t.uploading} ${index + 1}/${ordered.length}`);
        try {
          await drinksApi.addPhoto(created.id, await photoForUpload(photo.file), photo.kind);
        } catch (error) {
          toast.error(t.photoFailed, {
            description: error instanceof PhotoTooLarge ? undefined : errorMessage(error),
          });
        }
      }
      return created;
    },
    onSuccess: (saved) => {
      haptic('success');
      toast.success(drink ? t.saved : t.added(saved.name));
      onDone();
      if (!drink) onCreated?.(saved);
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => {
      setProgress(null);
      void client.invalidateQueries({ queryKey: drinksKeys.all });
    },
  });

  const pickPhoto = (kind: PhotoKind, file: File | undefined) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    setPhotos((list) => [
      ...list.filter((p) => p.kind !== kind || kind === 'other'),
      { kind, file, preview },
    ]);
  };

  const styleHints = (STYLE_HINTS[category] ?? []).filter((s) => s !== style);
  const tagHints = knownTags.filter((tag) => !splitList(tags).includes(tag)).slice(0, 10);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !save.isPending) save.mutate();
      }}
    >
      {!drink ? (
        <div>
          <div className="grid grid-cols-2 gap-2.5">
            {(['front', 'back'] as const).map((kind) => {
              const picked = photos.find((p) => p.kind === kind);
              return (
                <PhotoSlot
                  key={kind}
                  label={kind === 'front' ? t.addFront : t.addBack}
                  preview={picked?.preview}
                  onPick={(file) => pickPhoto(kind, file)}
                  onClear={() => setPhotos((list) => list.filter((p) => p.kind !== kind))}
                  clearLabel={t.removePhoto}
                />
              );
            })}
          </div>
          <p className="mt-2 px-1 text-xs text-ink-500">{t.photosHint}</p>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.kind}</p>
        <div
          role="radiogroup"
          aria-label={t.kind}
          className="-mx-1 flex flex-wrap gap-1.5 px-1"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                'press h-9 rounded-pill px-3.5 text-sm font-semibold transition-colors',
                category === c ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              {t.category[c]}
            </button>
          ))}
        </div>
      </div>

      <TextField
        label={t.name}
        placeholder={t.namePlaceholder}
        value={name}
        maxLength={160}
        autoFocus={!drink && !from}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label={t.fact.producer}
        placeholder={t.producerPlaceholder}
        value={producer}
        maxLength={120}
        onChange={(e) => setProducer(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <TextField
          label={t.fact.vintage}
          inputMode="numeric"
          placeholder={t.vintagePlaceholder}
          value={vintage}
          maxLength={4}
          error={vintageOk ? undefined : '1800–' + (yearNow + 1)}
          onChange={(e) => setVintage(e.target.value.replace(/\D/g, ''))}
        />
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">{t.fact.country}</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={cx(fieldClass, 'h-14 appearance-none py-0')}
          >
            <option value="">{t.pickCountry}</option>
            <optgroup label="—">
              {countries
                .filter((c) => c.common)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="A–Z">
              {countries
                .filter((c) => !c.common)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </div>

      {winey ? (
        <div>
          <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.fact.color}</p>
          <Segmented
            label={t.fact.color}
            value={color || ('' as WineColor | '')}
            onChange={(value) => setColor(value === color ? '' : value)}
            options={WINE_COLORS.map((c) => ({ value: c as WineColor | '', label: t.color[c] }))}
          />
        </div>
      ) : null}

      <div>
        <TextField
          label={t.fact.style}
          placeholder={t.stylePlaceholder}
          value={style}
          maxLength={80}
          onChange={(e) => setStyle(e.target.value)}
        />
        {styleHints.length ? (
          <Hints items={styleHints} onPick={setStyle} />
        ) : null}
      </div>

      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore((v) => !v)}
        className="press -mx-1 flex items-center justify-between rounded-2xl px-1 py-1 text-left text-[0.9375rem] font-semibold"
      >
        {more ? t.fewerDetails : t.moreDetails}
        <ExpandMoreIcon
          fontSize="inherit"
          className={cx('text-xl text-ink-500 transition-transform', more && 'rotate-180')}
        />
      </button>

      {more ? (
        <div className="flex animate-rise flex-col gap-5">
          <div className="grid grid-cols-2 gap-2.5">
            <TextField
              label={t.fact.line}
              placeholder={t.linePlaceholder}
              value={line}
              maxLength={120}
              onChange={(e) => setLine(e.target.value)}
            />
            <TextField
              label={t.fact.variant}
              placeholder={t.variantPlaceholder}
              value={variant}
              maxLength={120}
              onChange={(e) => setVariant(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <TextField
              label={t.fact.ageYears}
              inputMode="numeric"
              placeholder={t.ageHint}
              value={ageYears}
              maxLength={3}
              onChange={(e) => setAgeYears(e.target.value.replace(/\D/g, ''))}
            />
            <TextField
              label={`${t.fact.abv}, %`}
              inputMode="decimal"
              placeholder="13.5"
              value={abv}
              maxLength={5}
              error={abvOk ? undefined : '0–100'}
              onChange={(e) => setAbv(e.target.value)}
            />
            <TextField
              label={`${t.fact.volumeMl}, ml`}
              inputMode="numeric"
              placeholder="750"
              value={volumeMl}
              maxLength={5}
              onChange={(e) => setVolumeMl(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextField
              label={t.fact.region}
              placeholder={t.regionPlaceholder}
              value={region}
              maxLength={120}
              onChange={(e) => setRegion(e.target.value)}
            />
            <TextField
              label={t.fact.appellation}
              placeholder={t.appellationPlaceholder}
              value={appellation}
              maxLength={120}
              onChange={(e) => setAppellation(e.target.value)}
            />
          </div>
          {winey ? (
            <TextField
              label={t.fact.grapes}
              placeholder={t.grapesPlaceholder}
              hint={t.commaHint}
              value={grapes}
              onChange={(e) => setGrapes(e.target.value)}
            />
          ) : null}
          {kind === 'spirit' ? (
            <TextField
              label={t.fact.cask}
              placeholder={t.caskPlaceholder}
              value={cask}
              maxLength={120}
              onChange={(e) => setCask(e.target.value)}
            />
          ) : null}
          <TextField
            label={t.producedOnLabel}
            type="date"
            value={producedOn}
            onChange={(e) => setProducedOn(e.target.value)}
          />
          <Area
            label={t.backLabel}
            value={labelText}
            onChange={setLabelText}
            placeholder={t.labelPlaceholder}
            rows={4}
            max={4000}
          />
          <div>
            <TextField
              label={t.fact.tags}
              placeholder={t.tagsPlaceholder}
              hint={t.commaHint}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            {tagHints.length ? (
              <Hints
                items={tagHints}
                onPick={(tag) => setTags([...splitList(tags), tag].join(', '))}
              />
            ) : null}
          </div>
          <Area
            label={t.notes}
            value={notes}
            onChange={setNotes}
            placeholder={t.notesPlaceholder}
            rows={3}
            max={4000}
          />
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-4 rounded-[1.5rem] bg-ink-50 p-4">
        <legend className="sr-only">{t.cellarSection}</legend>
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[0.9375rem] font-semibold">{t.stockLabel}</span>
            <span className="block text-xs text-ink-500">{t.cellarSection}</span>
          </span>
          <Stepper
            value={stock}
            onChange={setStock}
            less={t.removeBottle}
            more={t.addBottle}
          />
        </div>
        {stock > 0 ? (
          <>
            <TextField
              label={t.where}
              placeholder={t.wherePlaceholder}
              value={location}
              maxLength={80}
              surface="raised"
              onChange={(e) => setLocation(e.target.value)}
            />
            <Switch checked={opened} onChange={setOpened} label={t.isOpen} />
          </>
        ) : null}
        <Switch checked={wanted} onChange={setWanted} label={t.wantToTry} hint={t.wantToTryHint} />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <TextField
            label={t.price}
            inputMode="decimal"
            placeholder="0"
            value={price}
            surface="raised"
            error={priceOk ? undefined : '≥ 0'}
            onChange={(e) => setPrice(e.target.value)}
          />
          <select
            aria-label={t.currency}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-14 rounded-[1.125rem] bg-white px-3 text-base font-semibold shadow-[var(--shadow-xs)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          >
            {[...new Set([currency, ...CURRENCIES])].map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <TextField
            label={t.boughtAt}
            placeholder={t.boughtAtPlaceholder}
            value={boughtAt}
            maxLength={120}
            surface="raised"
            onChange={(e) => setBoughtAt(e.target.value)}
          />
          <TextField
            label={t.boughtOnLabel}
            type="date"
            value={boughtOn}
            surface="raised"
            onChange={(e) => setBoughtOn(e.target.value)}
          />
        </div>
      </fieldset>

      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!ready}>
        {progress ?? t.save}
      </Button>
    </form>
  );
}

function Hints({ items, onPick }: { items: string[]; onPick: (value: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPick(item)}
          className="press h-8 rounded-pill bg-white px-3 text-[0.8125rem] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function Area({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  max = 4000,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{label}</span>
      <textarea
        value={value}
        maxLength={max}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cx(fieldClass, 'resize-y leading-relaxed')}
      />
    </label>
  );
}

export function Stepper({
  value,
  onChange,
  less,
  more,
  min = 0,
  max = 9999,
}: {
  value: number;
  onChange: (value: number) => void;
  less: string;
  more: string;
  min?: number;
  max?: number;
}) {
  const step = (delta: number) => {
    haptic('tap');
    onChange(Math.min(max, Math.max(min, value + delta)));
  };
  return (
    <span className="flex items-center gap-1 rounded-pill bg-white p-1 shadow-[var(--shadow-xs)]">
      <button
        type="button"
        aria-label={less}
        disabled={value <= min}
        onClick={() => step(-1)}
        className="press grid size-9 place-items-center rounded-full text-xl text-ink-800 hover:bg-ink-50 disabled:opacity-30"
      >
        <RemoveIcon fontSize="inherit" />
      </button>
      <span className="tabular w-8 text-center text-lg font-bold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={more}
        disabled={value >= max}
        onClick={() => step(1)}
        className="press grid size-9 place-items-center rounded-full bg-ink-900 text-xl text-white hover:bg-ink-800 disabled:opacity-30"
      >
        <AddIcon fontSize="inherit" />
      </button>
    </span>
  );
}

/** A photo to add: the camera or the library, a preview once picked. */
export function PhotoSlot({
  label,
  preview,
  onPick,
  onClear,
  clearLabel,
}: {
  label: string;
  preview?: string;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div className="relative">
      <label
        className={cx(
          'press relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[1.25rem] text-center',
          preview ? 'bg-ink-100' : 'bg-ink-50 ring-1 ring-inset ring-ink-200 hover:bg-ink-100',
        )}
      >
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <AddPhotoIcon fontSize="inherit" className="text-[1.75rem] text-ink-500" />
            <span className="px-2 text-[0.8125rem] font-semibold text-ink-700">{label}</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {preview ? (
          <span className="absolute inset-x-2 bottom-2 rounded-pill bg-white/90 px-2 py-1 text-xs font-semibold text-ink-900">
            {label}
          </span>
        ) : null}
      </label>
      {preview ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={onClear}
          className="press absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/95 text-lg text-ink-900 shadow-[var(--shadow-xs)]"
        >
          <CloseIcon fontSize="inherit" />
        </button>
      ) : null}
    </div>
  );
}
