import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button, TextField, toast } from '@/components/ui';
import { AddPhotoIcon, PlaceIcon, SparkleIcon, UploadIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { closetApi, closetKeys, type Place } from '../api';
import { CATEGORIES, CATEGORY_IDS, sizeSystemFor, type Category, type ClosetColor } from '../catalog';
import {
  ClosetScreen,
  ColorPicker,
  Field,
  PickOne,
  PlacePicker,
} from '../components/parts';
import { STUDIO, recentPlaces, rememberPlace, useOwner } from '../state';
import { cutOut, finish, modelReady, preparePhoto, type Finished, type Prepared } from '../images';
import { useClosetT } from '../i18n';
import { pathLabel } from '../places';

type CutState = 'idle' | 'loading' | 'cutting' | 'done' | 'failed';

/** The last kind and place used: the next piece of a batch is usually like the one before. */
let lastCategory: Category | '' = '';

/**
 * Adding pieces: photos from the camera or the gallery (several at once wait in a tray), then for
 * each one the background lifted off right here, a look before and after, and three quick choices
 * — kind, colour (guessed from the photo), place (the last one used). Everything else can wait.
 */
export default function AddPage() {
  const t = useClosetT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [owner] = useOwner();
  const overview = useQuery({ queryKey: closetKeys.overview(owner), queryFn: () => closetApi.overview(owner) });
  const places = overview.data?.places ?? [];
  const byId = new Map(places.map((p) => [p.id, p]));

  const [queue, setQueue] = useState<File[]>([]);
  const [added, setAdded] = useState(0);
  const [lastId, setLastId] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    e.target.value = '';
    if (files.length) setQueue((q) => [...q, ...files]);
  };

  const next = (savedId?: string) => {
    if (savedId) {
      setAdded((n) => n + 1);
      setLastId(savedId);
    }
    setQueue((q) => {
      const rest = q.slice(1);
      if (!rest.length) {
        void queryClient.invalidateQueries({ queryKey: closetKeys.all });
        const total = added + (savedId ? 1 : 0);
        if (total) toast.success(t.allDone(total));
        if (total === 1 && (savedId ?? lastId)) navigate(`/closet/${savedId ?? lastId}`, { replace: true });
        else navigate('/closet', { replace: true });
      }
      return rest;
    });
  };

  const current = queue[0];
  return (
    <ClosetScreen title={t.addTitle} subtitle={queue.length > 1 ? t.tray(queue.length) : undefined}>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={gallery} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={onFiles} />
      {current ? (
        <Piece
          key={`${current.name}-${current.lastModified}-${queue.length}`}
          file={current}
          last={queue.length === 1}
          places={places}
          placeLabel={(id) => pathLabel(byId, id)}
          ownerId={owner === 'me' || owner === 'all' ? undefined : owner}
          onSaved={(id) => next(id)}
          onSkip={() => next()}
        />
      ) : (
        <section className="mt-2 rounded-[1.75rem] p-6 shadow-[var(--shadow-card)] sm:p-8" style={STUDIO}>
          <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-700">{t.pickHint}</p>
          {!modelReady() ? <p className="mt-3 max-w-prose text-sm text-ink-500">{t.modelFirst}</p> : null}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button icon={AddPhotoIcon} onClick={() => camera.current?.click()}>
              {t.takePhoto}
            </Button>
            <Button variant="soft" icon={UploadIcon} onClick={() => gallery.current?.click()}>
              {t.pickPhotos}
            </Button>
          </div>
        </section>
      )}
    </ClosetScreen>
  );
}

function Piece({
  file,
  last,
  places,
  placeLabel,
  ownerId,
  onSaved,
  onSkip,
}: {
  file: File;
  last: boolean;
  places: Place[];
  placeLabel: (id: string | null) => string;
  ownerId?: string;
  onSaved: (id: string) => void;
  onSkip: () => void;
}) {
  const t = useClosetT();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [cut, setCut] = useState<CutState>('idle');
  const [progress, setProgress] = useState(0);
  const [cutout, setCutout] = useState<Finished | null>(null);
  const [plain, setPlain] = useState<Finished | null>(null);
  const [keep, setKeep] = useState(false);
  const [slider, setSlider] = useState(100);
  const [category, setCategory] = useState<Category | ''>(lastCategory);
  const [subcategory, setSubcategory] = useState('');
  const [colors, setColors] = useState<ClosetColor[]>([]);
  const [suggested, setSuggested] = useState<ClosetColor[]>([]);
  const [typed, setTyped] = useState('');
  const [named, setNamed] = useState(false);
  const [placeId, setPlaceId] = useState<string | null>(() => recentPlaces()[0] ?? null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prepare, then lift the background off; when that can't work here, the photo stays as it is.
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    void (async () => {
      try {
        const p = await preparePhoto(file);
        if (!live) return;
        urls.push(p.url);
        setPrepared(p);
        setCut(modelReady() ? 'cutting' : 'loading');
        const blob = await cutOut(p.blob, (fraction) => {
          if (!live) return;
          setProgress(fraction);
          if (fraction >= 1) setCut('cutting');
        });
        if (!live) return;
        const done = await finish(blob, true);
        urls.push(done.previewUrl);
        if (!live) return;
        setCutout(done);
        setSuggested(done.colors);
        setColors((c) => (c.length ? c : done.colors.slice(0, 1)));
        setCut('done');
        setSlider(100);
      } catch (error) {
        console.warn('[closet] cut-out failed', error);
        if (!live) return;
        setCut('failed');
        setKeep(true);
      }
    })();
    return () => {
      live = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file]);

  // The photo as it is, made only when it's wanted (kept, or the cut-out failed).
  useEffect(() => {
    if (!keep || plain || !prepared) return;
    let live = true;
    void finish(prepared.blob, false).then((done) => {
      if (!live) return;
      setPlain(done);
      if (!cutout) {
        setSuggested(done.colors);
        setColors((c) => (c.length ? c : done.colors.slice(0, 1)));
      }
    });
    return () => {
      live = false;
    };
  }, [keep, plain, prepared, cutout]);

  // A name from the colour and the kind, until the person types their own.
  const kindWord = subcategory ? t.sub[subcategory] : category ? t.category[category] : '';
  const colourWord = colors[0] ? t.color[colors[0]] : '';
  const name = named ? typed : [colourWord, (kindWord ?? '').toLowerCase()].filter(Boolean).join(' ');

  const chosen = keep ? plain : cutout;
  const ready = Boolean(chosen) && Boolean(category) && name.trim().length > 0;

  const save = async () => {
    if (!chosen || !category) return;
    setSaving(true);
    try {
      const { item } = await closetApi.add({
        name: name.trim(),
        category,
        subcategory,
        colors,
        placeId,
        sizeSystem: sizeSystemFor(category),
        ...(ownerId ? { ownerId } : {}),
      });
      const { storage } = await closetApi.addPhoto(item.id, {
        image: chosen.dataUrl,
        kind: 'front',
        needsCutout: keep && cut === 'failed',
      });
      if (storage.warn) toast.info(t.storageWarn);
      lastCategory = category;
      rememberPlace(placeId);
      haptic('success');
      onSaved(item.id);
    } catch (error) {
      toast.error(errorMessage(error));
      setSaving(false);
    }
  };

  const subs = category ? (CATEGORIES[category] as readonly string[]) : [];

  return (
    <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-8">
      {/* The picture: before under, after over, a slider between them. */}
      <div className="md:sticky md:top-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-card)]" style={STUDIO}>
          {prepared ? (
            <img src={prepared.url} alt="" className={cx('absolute inset-0 size-full object-contain', cutout && !keep ? 'opacity-100' : '')} />
          ) : null}
          {cutout && !keep ? (
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - slider}% 0 0)`, ...STUDIO }}
            >
              <span aria-hidden="true" className="absolute inset-x-[20%] bottom-[7%] h-[5%] rounded-[50%] bg-ink-900/10 blur-md" />
              <img
                src={cutout.previewUrl}
                alt=""
                className="absolute inset-0 size-full object-contain p-[8%] pb-[11%] [filter:drop-shadow(0_12px_14px_rgb(29_29_36/0.14))] animate-fade-in"
              />
            </div>
          ) : null}
          {cut === 'loading' || cut === 'cutting' || cut === 'idle' ? (
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/90 p-3 shadow-[var(--shadow-xs)] backdrop-blur" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <SparkleIcon fontSize="inherit" className="animate-pulse text-lg text-lav-600" />
                {cut === 'loading' ? t.modelLoad(Math.round(progress * 100)) : t.cutting}
              </p>
              {cut === 'loading' ? (
                <>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-ink-100">
                    <span className="block h-full rounded-pill bg-ink-900 transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </span>
                  <p className="mt-2 text-xs leading-snug text-ink-600">{t.modelFirst}</p>
                </>
              ) : null}
            </div>
          ) : null}
          {cut === 'failed' ? (
            <p className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/90 p-3 text-sm text-ink-700 shadow-[var(--shadow-xs)]">{t.cutFailed}</p>
          ) : null}
        </div>
        {cutout && !keep ? (
          <label className="mt-3 flex items-center gap-3 px-1 text-xs font-semibold text-ink-500">
            {t.before}
            <input
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="h-1 flex-1 accent-ink-900"
            />
            {t.after}
          </label>
        ) : null}
        {cut === 'done' ? (
          <label className="mt-3 flex items-center gap-2 px-1 text-sm font-semibold text-ink-700">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="size-4 accent-ink-900" />
            {t.keepOriginal}
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <Field label={t.category_}>
          <PickOne
            label={t.category_}
            options={CATEGORY_IDS}
            value={category}
            clearable={false}
            word={(c) => t.category[c]}
            onChange={(c) => {
              setCategory(c);
              setSubcategory('');
            }}
          />
        </Field>
        {subs.length ? (
          <Field label={t.subcategory}>
            <PickOne label={t.subcategory} options={subs} value={subcategory} word={(s) => t.sub[s] ?? s} onChange={setSubcategory} />
          </Field>
        ) : null}
        <Field label={t.colour}>
          <ColorPicker label={t.colour} value={colors} suggested={suggested} onChange={setColors} />
        </Field>
        <Field label={t.place}>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="press flex h-12 w-full items-center gap-2 rounded-2xl bg-ink-50 px-4 text-left text-[0.9375rem] font-medium text-ink-900 hover:bg-ink-100"
          >
            <PlaceIcon fontSize="inherit" className="text-lg text-ink-500" />
            <span className="min-w-0 truncate">{placeId ? placeLabel(placeId) : t.noPlace}</span>
          </button>
        </Field>
        <TextField
          label={t.name}
          value={name}
          maxLength={120}
          onChange={(e) => {
            setNamed(true);
            setTyped(e.target.value);
          }}
        />
        <div className="flex flex-col gap-2.5">
          <Button fullWidth disabled={!ready} loading={saving} onClick={() => void save()}>
            {last ? t.saveDone : t.saveNext}
          </Button>
          <Button fullWidth variant="ghost" disabled={saving} onClick={onSkip}>
            {t.skip}
          </Button>
        </div>
      </div>

      <PlacePicker
        open={picking}
        onClose={() => setPicking(false)}
        places={places}
        value={placeId}
        recent={recentPlaces()}
        onChange={setPlaceId}
      />
    </div>
  );
}
