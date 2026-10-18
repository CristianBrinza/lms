import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Button, IconButton, Sheet, Skeleton, toast } from '@/components/ui';
import {
  AddPhotoIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DeleteIcon,
  EditIcon,
  FavoriteBorderIcon,
  FavoriteIcon,
  PlaceIcon,
  ReplayIcon,
  SparkleIcon,
  StarIcon,
} from '@/components/ui/icons';
import { formatNumber, intlLocale } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { closetApi, closetKeys, type ItemDetail, type Photo, type PhotoKind, type Status } from '../api';
import { STATUSES, STORAGE_ADVICE, type Material } from '../catalog';
import { CareSymbols } from '../components/CareSymbols';
import { TouchUp } from '../components/TouchUp';
import { StraightenSheet } from '../components/StraightenSheet';
import { ItemSheet } from '../components/ItemSheet';
import {
  ClosetScreen,
  ErrorCard,
  PlacePicker,
  Section,
  Studio,
  Swatch,
} from '../components/parts';
import { recentPlaces, rememberPlace, useOwner } from '../state';
import { cutOut, finish, polishCutout, preparePhoto } from '../images';
import { useClosetT } from '../i18n';
import { placeName, placePath } from '../places';
import { slideIndex } from '../gallery';

type CutMode = 'plain' | '3d' | 'vector' | 'tryon';

/** Which friendly reason a try-on failure carries (the server writes `failed: <reason>`). */
const tryonReasonKey = (status: string) =>
  /quota/i.test(status)
    ? 'quota'
    : /busy/i.test(status)
      ? 'busy'
      : /starting up/i.test(status)
        ? 'asleep'
        : /too long/i.test(status)
          ? 'timeout'
          : /mannequin/i.test(status)
            ? 'fit'
            : 'failed';

/** Cut-outs first (front, back), then the AI try-ons, then the photos as taken, then the label, then details. */
const galleryRank = (photo: Photo) =>
  photo.kind === 'tryon'
    ? 1.5
    : (photo.kind === 'label' ? 2 : photo.kind === 'detail' ? 3 : photo.superseded ? 1 : 0) * 2 + (photo.kind === 'back' ? 1 : 0);
const galleryOrder = (photos: Photo[], originals: Photo[]) =>
  [...photos, ...originals]
    .map((photo, i) => ({ photo, i }))
    .sort((a, b) => galleryRank(a.photo) - galleryRank(b.photo) || a.i - b.i)
    .map(({ photo }) => photo);

/** A photo turned 90° clockwise, as a blob (PNG when it has transparency). */
async function rotateBlob(source: Blob, keepAlpha: boolean): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.height;
    canvas.height = bitmap.width;
    const context = canvas.getContext('2d')!;
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('rotate'))), keepAlpha ? 'image/png' : 'image/jpeg', 0.92),
    );
  } finally {
    bitmap.close();
  }
}

const day = (iso: string) =>
  new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`));
const money = (value: number, currency: string) =>
  new Intl.NumberFormat(intlLocale(), { style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
const today = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * A piece: its photos (the label last) on the studio backdrop, where it lives, whether it's clean,
 * how often it's worn and what it costs a wear, what it's made of and how to care for it.
 */
export default function ItemPage() {
  const t = useClosetT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [owner] = useOwner();
  const query = useQuery({ queryKey: closetKeys.item(id), queryFn: () => closetApi.item(id) });
  const overview = useQuery({ queryKey: closetKeys.overview(owner), queryFn: () => closetApi.overview(owner) });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [picking, setPicking] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: closetKeys.all });
  const update = useMutation({
    mutationFn: (patch: Parameters<typeof closetApi.update>[1]) => closetApi.update(id, patch),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<ItemDetail>(closetKeys.item(id), (old) => (old ? { ...old, item } : old));
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const worn = useMutation({
    mutationFn: () => closetApi.worn(id),
    onSuccess: () => {
      haptic('success');
      toast.success(t.wornLogged);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => closetApi.remove(id),
    onSuccess: () => {
      refresh();
      navigate('/closet', { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const detail = query.data;
  if (query.isPending)
    return (
      <ClosetScreen title=" ">
        <Skeleton className="aspect-[4/5] rounded-[1.75rem]" />
      </ClosetScreen>
    );
  if (!detail)
    return (
      <ClosetScreen title={t.title}>
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      </ClosetScreen>
    );

  const { item } = detail;
  const places = overview.data?.places ?? [];
  const byId = new Map(places.map((p) => [p.id, p]));
  const path = placePath(byId, item.placeId);
  const title = item.name || (item.subcategory ? t.sub[item.subcategory] : item.category ? t.category[item.category] : '—');
  const kind = [item.category ? t.category[item.category] : '', item.subcategory ? t.sub[item.subcategory] : '']
    .filter(Boolean)
    .join(' · ');
  const advice =
    item.storageAdvice ||
    (() => {
      const main = [...item.materials].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
      const key = main ? STORAGE_ADVICE[main.material as Material] : undefined;
      return key ? t.careAdvice[key] : '';
    })();
  const wornToday = detail.worn[0] === today();

  return (
    <ClosetScreen
      title={title}
      subtitle={kind || undefined}
      actions={
        <>
          <IconButton
            icon={item.favorite ? FavoriteIcon : FavoriteBorderIcon}
            label={t.edit}
            variant="white"
            size="sm"
            className={item.favorite ? 'text-pink-400' : undefined}
            onClick={() => {
              haptic('tap');
              update.mutate({ favorite: !item.favorite });
            }}
          />
          <IconButton icon={EditIcon} label={t.edit} variant="ink" size="sm" onClick={() => setEditing(true)} />
        </>
      }
    >
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8">
        <div className="md:sticky md:top-4 md:self-start">
          <Photos detail={detail} onChanged={refresh} />
        </div>

        <div>
          {item.needsDetails ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="press mt-5 w-full rounded-2xl bg-butter-100 p-4 text-left text-sm font-medium text-ink-900 md:mt-0"
            >
              {t.needsDetailsHint}
            </button>
          ) : null}

          {/* Where it lives */}
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="press mt-5 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-[var(--shadow-xs)] md:mt-0"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lav-100 text-xl text-lav-700">
              <PlaceIcon fontSize="inherit" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink-500">{t.whereKept}</span>
              <span className="block truncate text-[0.9375rem] font-semibold text-ink-900">
                {path.length ? path.map(placeName).join(' › ') : t.noPlaceYet}
              </span>
              {item.storage ? <span className="block text-xs text-ink-600">{t.storage[item.storage]}</span> : null}
            </span>
          </button>

          {/* Status and wear */}
          <div className="mt-4 rounded-3xl bg-white p-4 shadow-[var(--shadow-xs)]">
            <StatusSwitch value={item.status} onChange={(status) => update.mutate({ status })} />
            {item.status === 'lent' ? (
              <input
                aria-label={t.lentTo}
                placeholder={t.lentTo}
                defaultValue={item.lentTo}
                onBlur={(e) => e.target.value !== item.lentTo && update.mutate({ lentTo: e.target.value })}
                className="mt-3 h-11 w-full rounded-2xl bg-ink-50 px-4 text-[0.9375rem] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
              />
            ) : null}
            <div className="mt-4 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold text-ink-900">
                  {item.wears ? t.wears(item.wears) : t.neverWorn}
                </p>
                <p className="text-xs text-ink-500">
                  {[
                    item.lastWorn ? t.lastWorn(day(item.lastWorn)) : '',
                    item.costPerWear !== null ? t.perWear(money(item.costPerWear, item.currency)) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Button
                size="sm"
                variant={wornToday ? 'tint' : 'primary'}
                icon={wornToday ? CheckIcon : undefined}
                loading={worn.isPending}
                disabled={wornToday}
                onClick={() => worn.mutate()}
              >
                {wornToday ? t.wornLogged : t.wornToday}
              </Button>
            </div>
            <WearStrip days={detail.worn} />
          </div>

          <Section title={t.details}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-3xl bg-white p-4 shadow-[var(--shadow-xs)]">
              {item.colors.length ? (
                <Fact label={t.colour} wide>
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {item.colors.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1.5">
                        <Swatch color={c} />
                        {t.color[c]}
                      </span>
                    ))}
                  </span>
                </Fact>
              ) : null}
              {item.materials.length ? (
                <Fact label={t.materials} wide>
                  <span className="flex flex-wrap gap-1.5">
                    {item.materials.map((m) => (
                      <span key={m.material} className="rounded-pill bg-butter-100 px-2.5 py-1 text-[0.8125rem] font-semibold text-ink-900">
                        {m.percent ? `${m.percent}% ` : ''}
                        {t.material[m.material]}
                      </span>
                    ))}
                  </span>
                </Fact>
              ) : null}
              {item.size ? <Fact label={t.size}>{[item.size, item.sizeSystem ? t.sizeSystem[item.sizeSystem] : ''].filter(Boolean).join(' · ')}</Fact> : null}
              {item.brand ? <Fact label={t.brand}>{item.brand}</Fact> : null}
              {item.price !== null ? <Fact label={t.price}>{money(item.price, item.currency)}</Fact> : null}
              {item.boughtOn ? <Fact label={t.boughtOn}>{day(item.boughtOn)}</Fact> : null}
              {item.store ? <Fact label={t.store}>{item.store}</Fact> : null}
              {item.fit ? <Fact label={t.fitLabel}>{t.fit[item.fit]}</Fact> : null}
              {item.seasons.length ? <Fact label={t.seasons}>{item.seasons.map((s) => t.season[s]).join(', ')}</Fact> : null}
              {item.occasions.length ? <Fact label={t.occasions}>{item.occasions.map((s) => t.occasion[s]).join(', ')}</Fact> : null}
              {item.madeIn ? <Fact label={t.madeIn}>{regionName(item.madeIn)}</Fact> : null}
              {item.condition ? (
                <Fact label={t.conditionLabel} wide>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {t.condition[item.condition]}
                    {item.issues.map((issue) => (
                      <span key={issue} className="rounded-pill bg-peach-100 px-2 py-0.5 text-xs font-semibold text-peach-800">
                        {t.issue[issue]}
                      </span>
                    ))}
                  </span>
                  {item.conditionNotes ? <span className="mt-1 block text-ink-600">{item.conditionNotes}</span> : null}
                </Fact>
              ) : null}
              {!item.colors.length && !item.materials.length && !item.size && !item.brand && item.price === null ? (
                <p className="col-span-2 text-sm text-ink-500">{t.needsDetailsHint}</p>
              ) : null}
            </dl>
          </Section>

          <Section title={t.care}>
            <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-xs)]">
              {item.care ? <CareSymbols care={item.care} /> : <p className="text-sm text-ink-600">{t.careEmpty}</p>}
              {advice ? (
                <div className="mt-4 rounded-2xl bg-mint-100 p-3.5">
                  <p className="text-xs font-semibold text-mint-800">{t.storageAdvice}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-900">{advice}</p>
                </div>
              ) : null}
              {item.labelText ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">{item.labelText}</p>
              ) : null}
            </div>
          </Section>

          {item.notes || item.tags.length || item.url ? (
            <Section title={t.notes}>
              <div className="rounded-3xl bg-white p-4 text-sm leading-relaxed text-ink-700 shadow-[var(--shadow-xs)]">
                {item.notes ? <p className="whitespace-pre-line">{item.notes}</p> : null}
                {item.tags.length ? <p className="mt-2 font-semibold text-ink-500">{item.tags.map((tag) => `#${tag}`).join(' ')}</p> : null}
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className="mt-2 block truncate font-semibold text-lav-700 underline">
                    {item.url}
                  </a>
                ) : null}
              </div>
            </Section>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link to="/closet/places" className="text-sm font-semibold text-ink-600 underline-offset-4 hover:underline">
              {t.managePlaces}
            </Link>
            <Button variant="ghost" size="sm" icon={DeleteIcon} className="text-danger-700" onClick={() => setDeleting(true)}>
              {t.delete}
            </Button>
          </div>
        </div>
      </div>

      {editing ? <ItemSheet item={item} open={editing} onClose={() => setEditing(false)} /> : null}
      <PlacePicker
        open={picking}
        onClose={() => setPicking(false)}
        places={places}
        value={item.placeId}
        recent={recentPlaces()}
        onChange={(placeId) => {
          rememberPlace(placeId);
          update.mutate({ placeId });
        }}
      />
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        title={t.deleteTitle}
        description={t.deleteBody}
        confirmLabel={t.delete}
        tone="danger"
        loading={remove.isPending}
      />
    </ClosetScreen>
  );
}

const regionName = (code: string) => {
  try {
    return new Intl.DisplayNames([intlLocale()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-xs font-semibold text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-[0.9375rem] text-ink-900">{children}</dd>
    </div>
  );
}

/** Clean / To wash / Away, and the rest one tap further. */
function StatusSwitch({ value, onChange }: { value: Status; onChange: (status: Status) => void }) {
  const t = useClosetT();
  const main: Status[] = ['clean', 'to_wash', 'lent'];
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-ink-500">{t.statusLabel}</p>
      <div role="radiogroup" aria-label={t.statusLabel} className="flex gap-1 rounded-pill bg-ink-100 p-1">
        {main.map((status) => (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={value === status}
            onClick={() => {
              haptic('tap');
              onChange(status);
            }}
            className={cx(
              'press h-9 flex-1 rounded-pill px-2 text-sm font-semibold transition-colors',
              value === status ? 'bg-white text-ink-900 shadow-[var(--shadow-xs)]' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {t.status[status]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {STATUSES.filter((s) => !main.includes(s)).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={value === status}
            onClick={() => onChange(status)}
            className={cx(
              'press h-8 rounded-pill px-3 text-xs font-semibold',
              value === status ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100',
            )}
          >
            {t.status[status]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The last twelve weeks, a dot a day: filled on a day it was worn. */
function WearStrip({ days }: { days: string[] }) {
  if (!days.length) return null;
  const worn = new Set(days);
  const cells: { date: string; on: boolean }[] = [];
  const now = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    cells.push({ date: iso, on: worn.has(iso) });
  }
  return (
    <div aria-hidden="true" className="mt-4 grid grid-flow-col grid-rows-7 gap-[3px]">
      {cells.map((cell) => (
        <span key={cell.date} className={cx('aspect-square rounded-[3px]', cell.on ? 'bg-ink-900' : 'bg-ink-100')} />
      ))}
    </div>
  );
}

/**
 * The photos: swipe through them (the label last), make one the cover, remove a background that's
 * still there (in the browser, the original is kept), add a photo or the label.
 */
function Photos({ detail, onChanged }: { detail: ItemDetail; onChanged: () => void }) {
  const t = useClosetT();
  const strip = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState(0);
  const [adding, setAdding] = useState<PhotoKind | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [mannequinSheet, setMannequinSheet] = useState(false);
  const mannequins = useQuery({ queryKey: ['closet', 'mannequins'], queryFn: closetApi.mannequins, enabled: mannequinSheet });
  const lastMannequin = mannequins.data?.mannequins.find((m) => m.userId === detail.item.ownerId)?.mannequin ?? null;
  const tryonRunning = detail.item.tryonStatus === 'running';
  const tryonFailed = detail.item.tryonStatus.startsWith('failed:');
  const [touching, setTouching] = useState<Blob | null>(null);
  const [touchingId, setTouchingId] = useState<string | null>(null);
  const [straightening, setStraightening] = useState<{ photo: Photo; blob: Blob } | null>(null);
  const photos = galleryOrder(detail.photos, detail.originals);
  const current: Photo | undefined = photos[Math.min(index, photos.length - 1)];
  // Any front/back photo that still has its background, flagged or not, so a cut-out can always be redone.
  const isBare = (p: Photo) => !p.superseded && !p.hasAlpha && (p.kind === 'front' || p.kind === 'back');
  const pending = photos.filter(isBare);
  const garmentPhoto = photos.find((p) => !p.superseded && p.kind !== 'label' && p.kind !== 'tryon');

  const goTo = (i: number) => {
    const track = strip.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  };

  // A new cut-out arrives: show the first photo once (the strip is never written back to otherwise).
  const lead = photos[0]?.id;
  useEffect(() => {
    strip.current?.scrollTo({ left: 0 });
  }, [lead, detail.photos.length]);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const kind = adding ?? 'front';
    if (!file) return;
    setBusy('upload');
    try {
      const prepared = await preparePhoto(file);
      const done = await finish(prepared.blob, false);
      URL.revokeObjectURL(prepared.url);
      URL.revokeObjectURL(done.previewUrl);
      await closetApi.addPhoto(detail.item.id, { image: done.dataUrl, kind, needsCutout: kind === 'front' || kind === 'back' });
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  /** Every front/back photo that still has its background, one at a time. */
  const removeBackgrounds = async (mode: CutMode) => {
    setChoosing(false);
    if (mode === 'tryon') {
      setMannequinSheet(true);
      return;
    }
    if (mode === 'vector') {
      await act(() => closetApi.requestVector(detail.item.id));
      return;
    }
    for (const photo of pending) {
      setBusy(photo.id);
      setProgress(0);
      try {
        const source = await (await fetch(photo.full, { credentials: 'same-origin' })).blob();
        const cut = await polishCutout(source, await cutOut(source, setProgress), mode === '3d');
        const done = await finish(cut, true);
        URL.revokeObjectURL(done.previewUrl);
        await closetApi.addPhoto(detail.item.id, { image: done.dataUrl, replaces: photo.id });
        haptic('success');
        onChanged();
      } catch (error) {
        toast.error(error instanceof Error && error.message ? t.cutFailed : errorMessage(error));
        break;
      }
    }
    setBusy(null);
  };

  const rotate = async (photo: Photo) => {
    setBusy(photo.id);
    try {
      const source = await (await fetch(photo.full, { credentials: 'same-origin' })).blob();
      const turned = await rotateBlob(source, photo.hasAlpha);
      const done = await finish(turned, photo.hasAlpha);
      URL.revokeObjectURL(done.previewUrl);
      await closetApi.addPhoto(detail.item.id, { image: done.dataUrl, rotates: photo.id });
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const openStraighten = async (photo: Photo) => {
    setBusy(photo.id);
    try {
      setStraightening({ photo, blob: await (await fetch(photo.full, { credentials: 'same-origin' })).blob() });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const openTouchUp = async (photo: Photo) => {
    setBusy(photo.id);
    try {
      setTouching(await (await fetch(photo.full, { credentials: 'same-origin' })).blob());
      setTouchingId(photo.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const saveTouchUp = async (result: Blob) => {
    if (!touchingId) return;
    try {
      const done = await finish(result, true);
      URL.revokeObjectURL(done.previewUrl);
      await closetApi.addPhoto(detail.item.id, { image: done.dataUrl, rotates: touchingId });
      setTouching(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const saveStraightened = async (result: Blob) => {
    if (!straightening) return;
    try {
      const done = await finish(result, true);
      URL.revokeObjectURL(done.previewUrl);
      await closetApi.addPhoto(detail.item.id, { image: done.dataUrl, rotates: straightening.photo.id });
      setStraightening(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const startTryon = async (mannequin: 'male' | 'female') => {
    setMannequinSheet(false);
    await act(async () => {
      await closetApi.tryon(detail.item.id, { mannequin });
      toast.success(t.tryonStarted);
    });
  };

  const act = async (work: () => Promise<unknown>) => {
    try {
      await work();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <input ref={input} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => void upload(e)} />
      {photos.length ? (
        <div className="relative">
        <div
          ref={strip}
          onScroll={(e) => {
            const next = slideIndex(e.currentTarget.scrollLeft, e.currentTarget.clientWidth, photos.length);
            setIndex((was) => (was === next ? was : next));
          }}
          style={{ touchAction: 'pan-x pan-y' }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[1.75rem] shadow-[var(--shadow-card)] [scrollbar-width:none]"
        >
          {photos.map((photo, i) => (
            <figure key={photo.id} className="w-full shrink-0 snap-center [scroll-snap-stop:always]">
              <Studio
                cover={{ id: photo.id, thumb: photo.thumb, full: photo.full, hasAlpha: photo.hasAlpha }}
                size="full"
                eager={i === 0}
                className="aspect-[4/5]"
              >
                <span className="absolute left-3 top-3 rounded-pill bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-[var(--shadow-xs)]">
                  {photo.superseded ? `${t.originalTag} · ${t.photoKind[photo.kind]}` : t.photoKind[photo.kind]}
                </span>
                {busy === photo.id ? (
                  <span className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/90 p-3 text-sm font-semibold text-ink-900 shadow-[var(--shadow-xs)]" aria-live="polite">
                    <SparkleIcon fontSize="inherit" className="mr-1.5 inline animate-pulse text-lav-600" />
                    {progress > 0 && progress < 1 ? t.modelLoad(Math.round(progress * 100)) : t.cutting}
                  </span>
                ) : null}
              </Studio>
            </figure>
          ))}
        </div>
        {photos.length > 1 ? (
        <div className="absolute bottom-3 right-3 flex gap-2">
          {index > 0 ? (
            <button
              type="button"
              aria-label={t.prevPhoto}
              onClick={() => goTo(index - 1)}
              className="press flex size-9 items-center justify-center rounded-full bg-white/80 text-[1.4rem] text-ink-900 shadow-[var(--shadow-xs)] backdrop-blur-md"
            >
              <ChevronLeftIcon fontSize="inherit" />
            </button>
          ) : null}
          {index < photos.length - 1 ? (
            <button
              type="button"
              aria-label={t.nextPhoto}
              onClick={() => goTo(index + 1)}
              className="press flex size-9 items-center justify-center rounded-full bg-white/80 text-[1.4rem] text-ink-900 shadow-[var(--shadow-xs)] backdrop-blur-md"
            >
              <ChevronRightIcon fontSize="inherit" />
            </button>
          ) : null}
        </div>
        ) : null}
        </div>
      ) : (
        <Studio cover={null} className="aspect-[4/5] rounded-[1.75rem] shadow-[var(--shadow-card)]" />
      )}

      {photos.length > 1 ? (
        <div className="mt-1.5 flex justify-center">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              aria-label={`${i + 1} / ${photos.length}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className="flex h-6 items-center px-[3px]"
            >
              <span className={cx('h-1.5 rounded-pill transition-all duration-300', i === index ? 'w-5 bg-ink-900' : 'w-1.5 bg-ink-300')} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {current && isBare(current) ? (
          <Button size="sm" icon={SparkleIcon} loading={busy === current.id} disabled={busy !== null} onClick={() => setChoosing(true)}>
            {t.removeBg}
          </Button>
        ) : null}
        {current ? (
          <Button size="sm" variant="tint" icon={ReplayIcon} disabled={busy !== null} onClick={() => void rotate(current)}>
            {t.rotate}
          </Button>
        ) : null}
        {current?.hasAlpha ? (
          <Button size="sm" variant="tint" disabled={busy !== null} onClick={() => void openStraighten(current)}>
            {t.straighten}
          </Button>
        ) : null}
        {current?.hasAlpha ? (
          <Button size="sm" variant="tint" disabled={busy !== null} onClick={() => void openTouchUp(current)}>
            {t.touchUp}
          </Button>
        ) : null}
        {current && !current.superseded && (current.kind === 'front' || current.kind === 'back') ? (
          <Button
            size="sm"
            variant={detail.item.cover?.id === current.id ? 'primary' : 'tint'}
            icon={StarIcon}
            aria-pressed={detail.item.cover?.id === current.id}
            onClick={() => {
              if (detail.item.cover?.id !== current.id) void act(() => closetApi.updatePhoto(current.id, { cover: true }));
            }}
          >
            {t.coverChip}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="tint"
          icon={AddPhotoIcon}
          loading={busy === 'upload' && adding === 'front'}
          disabled={busy !== null}
          onClick={() => {
            setAdding('front');
            input.current?.click();
          }}
        >
          {t.addPhoto}
        </Button>
        {!detail.item.hasLabel ? (
          <Button
            size="sm"
            variant="tint"
            loading={busy === 'upload' && adding === 'label'}
            disabled={busy !== null}
            onClick={() => {
              setAdding('label');
              input.current?.click();
            }}
          >
            {t.addLabel}
          </Button>
        ) : null}
        {garmentPhoto && !tryonRunning ? (
          <Button size="sm" variant="tint" icon={SparkleIcon} disabled={busy !== null} onClick={() => setMannequinSheet(true)}>
            {t.tryonOption}
          </Button>
        ) : null}
        {current && !current.superseded ? (
          <IconButton
            icon={DeleteIcon}
            label={t.removePhoto}
            variant="ghost"
            size="sm"
            onClick={() => void act(() => closetApi.removePhoto(current.id))}
          />
        ) : null}
      </div>
      {tryonRunning ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-700" aria-live="polite">
          <SparkleIcon fontSize="inherit" className="animate-pulse text-lav-600" />
          <span>{t.tryonRunning}</span>
        </p>
      ) : tryonFailed ? (
        <p className="mt-2 text-sm text-ink-700" role="status">
          {t.tryonReasons[tryonReasonKey(detail.item.tryonStatus)]}
        </p>
      ) : null}
      {detail.item.vectorRequested ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-700" aria-live="polite">
          <SparkleIcon fontSize="inherit" className="text-lav-600" />
          <span>{t.vectorWaiting}</span>
          <button
            type="button"
            className="font-semibold text-lav-700 underline-offset-2 hover:underline"
            onClick={() => void act(() => closetApi.cancelVector(detail.item.id))}
          >
            {t.vectorCancel}
          </button>
        </p>
      ) : null}
      {current && isBare(current) ? <p className="mt-2 text-xs text-ink-500">{t.removeBgHint}</p> : null}
      {photos.length > 1 ? <p className="sr-only">{formatNumber(index + 1)}</p> : null}
      <TouchUp source={touching} onClose={() => setTouching(null)} onSave={saveTouchUp} />
      <StraightenSheet source={straightening?.blob ?? null} onClose={() => setStraightening(null)} onSave={saveStraightened} />
      <Sheet open={choosing} onClose={() => setChoosing(false)} title={t.cutChoiceTitle} description={t.cutChoiceBody(pending.length)}>
        <div className="flex flex-col gap-2.5">
          {(['plain', '3d', 'vector', 'tryon'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => void removeBackgrounds(mode)}
              className="press rounded-2xl bg-ink-50 p-4 text-left hover:bg-ink-100"
            >
              <span className="block text-[0.9375rem] font-semibold text-ink-900">{mode === 'tryon' ? t.tryonOption : mode === 'vector' ? t.cutVector : mode === '3d' ? t.cut3d : t.cutOnly}</span>
              <span className="mt-0.5 block text-sm text-ink-600">{mode === 'tryon' ? t.tryonHint : mode === 'vector' ? t.cutVectorHint : mode === '3d' ? t.cut3dHint : t.cutOnlyHint}</span>
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={mannequinSheet} onClose={() => setMannequinSheet(false)} title={t.tryonChoose} description={t.tryonChooseBody}>
        <div className="grid grid-cols-2 gap-3">
          {(['male', 'female'] as const).map((which) => (
            <button
              key={which}
              type="button"
              onClick={() => void startTryon(which)}
              className="press flex min-h-32 flex-col items-center justify-center gap-1 rounded-2xl bg-ink-50 p-4 text-center hover:bg-ink-100"
            >
              <span className="text-[0.9375rem] font-semibold text-ink-900">{which === 'male' ? t.mannequinMale : t.mannequinFemale}</span>
              {lastMannequin === which ? <span className="text-xs text-ink-600">{t.mannequinLast}</span> : null}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
