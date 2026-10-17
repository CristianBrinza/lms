import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Avatar, Button, ButtonLink, IconButton, ListGroup, ListRowButton, Sheet, Skeleton, Switch, toast } from '@/components/ui';
import {
  AddIcon,
  AddPhotoIcon,
  DeleteIcon,
  EditIcon,
  ExpandMoreIcon,
  MoreHorizIcon,
  PlaceIcon,
  QuoteIcon,
  WineBarIcon,
} from '@/components/ui/icons';
import { money } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import {
  drinksApi,
  drinksKeys,
  type Drink,
  type DrinkDetail,
  type DrinkPerson,
  type DrinksResponse,
  type Photo,
  type PhotoKind,
  type Tasting,
} from '../api';
import { DrinkCard } from '../components/DrinkCard';
import { DrinkSheet, Stepper } from '../components/DrinkSheet';
import { Gallery, type GalleryPhoto } from '../components/Gallery';
import { Cover, DrinksScreen, ErrorCard, Section, Stars } from '../components/parts';
import { SheetSummary } from '../components/SheetSummary';
import { TastingSheet } from '../components/TastingSheet';
import { countryName, stars } from '../format';
import { photoForUpload, PhotoTooLarge } from '../images';
import { useDrinksT } from '../i18n';

/**
 * One drink: the label photo large, what everyone thought of it, what's at home, every fact the
 * label gave, each tasting with its sheet, the price it was bought at, and its other versions.
 */
export default function DrinkPage() {
  const { id = '' } = useParams();
  const t = useDrinksT();
  const query = useQuery({ queryKey: drinksKeys.drink(id), queryFn: () => drinksApi.get(id) });
  const data = query.data;
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [versioning, setVersioning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => drinksApi.remove(id),
    onSuccess: () => {
      toast.success(t.deleted(data?.drink.name ?? ''));
      navigate('/drinks', { replace: true });
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: drinksKeys.all }),
  });

  const drink = data?.drink;
  // The tags in use, from the cellar's list when it was loaded (suggestions in the form).
  const tags = client.getQueryData<DrinksResponse>(drinksKeys.list)?.tags ?? [];
  return (
    <DrinksScreen
      title={drink?.name ?? ' '}
      subtitle={drink ? [t.category[drink.category], drink.vintage].filter(Boolean).join(' · ') : ' '}
      actions={
        drink ? (
          <>
            <IconButton icon={EditIcon} label={t.edit} variant="white" onClick={() => setEditing(true)} />
            <IconButton icon={MoreHorizIcon} label={t.more} variant="white" onClick={() => setMenu(true)} />
          </>
        ) : null
      }
    >
      {query.isPending ? (
        <DrinkSkeleton />
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : data && drink ? (
        <Body data={data} />
      ) : (
        <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="font-semibold">{t.notFound}</p>
          <ButtonLink to="/drinks" size="sm" variant="tint" className="mt-3">
            {t.backToCellar}
          </ButtonLink>
        </div>
      )}

      {drink ? (
        <>
          <DrinkSheet
            open={editing}
            onClose={() => setEditing(false)}
            drink={drink}
            tags={tags}
            currency={drink.currency}
          />
          <DrinkSheet
            open={versioning}
            onClose={() => setVersioning(false)}
            from={drink}
            tags={tags}
            currency={drink.currency}
            onCreated={(created) => navigate(`/drinks/${created.id}`, { viewTransition: true })}
          />
          <Sheet open={menu} onClose={() => setMenu(false)} title={drink.name}>
            <ListGroup>
              <ListRowButton
                icon={AddIcon}
                label={t.newVersion}
                detail={t.newVersionHint}
                onClick={() => {
                  setMenu(false);
                  setVersioning(true);
                }}
              />
              <ListRowButton
                icon={DeleteIcon}
                tone="danger"
                label={t.deleteDrink}
                onClick={() => {
                  setMenu(false);
                  setDeleting(true);
                }}
              />
            </ListGroup>
          </Sheet>
          <ConfirmSheet
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={() => remove.mutate()}
            title={t.deleteConfirm(drink.name)}
            description={t.deleteBody}
            confirmLabel={t.deleteDrink}
            tone="danger"
            loading={remove.isPending}
          />
        </>
      ) : null}
    </DrinksScreen>
  );
}

function DrinkSkeleton() {
  return (
    <div aria-hidden="true" className="md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:gap-6">
      <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[20rem] rounded-[1.75rem]" />
      <div className="mt-5 flex flex-col gap-3 md:mt-0">
        <Skeleton className="h-8 w-2/3 rounded-xl" />
        <Skeleton className="h-28 rounded-[1.5rem]" />
        <Skeleton className="h-40 rounded-[1.5rem]" />
      </div>
    </div>
  );
}

function Body({ data }: { data: DrinkDetail }) {
  const { drink, photos, tastings, insights, prices, family, people } = data;
  const t = useDrinksT();
  const client = useQueryClient();
  const [tasting, setTasting] = useState<Tasting | null | 'new'>(null);
  const [gallery, setGallery] = useState<{ photos: GalleryPhoto[]; start: number } | null>(null);
  const bottlePhotos = photos.filter((p) => !p.tastingId);

  const refresh = () => client.invalidateQueries({ queryKey: drinksKeys.all });
  const failed = (error: unknown) => toast.error(t.failed, { description: errorMessage(error) });
  const cover = useMutation({
    mutationFn: (photo: GalleryPhoto) => drinksApi.updatePhoto(photo.id, { cover: true }),
    onSuccess: () => setGallery(null),
    onError: failed,
    onSettled: refresh,
  });
  const removePhoto = useMutation({
    mutationFn: (photo: GalleryPhoto) => drinksApi.removePhoto(photo.id),
    onSuccess: (_, photo) =>
      setGallery((open) =>
        open ? { ...open, photos: open.photos.filter((p) => p.id !== photo.id), start: 0 } : open,
      ),
    onError: failed,
    onSettled: refresh,
  });

  return (
    <>
      <div className="md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:items-start md:gap-7 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="md:sticky md:top-4">
          <button
            type="button"
            aria-label={t.openGallery}
            disabled={!bottlePhotos.length}
            onClick={() => setGallery({ photos: bottlePhotos, start: 0 })}
            className="press mx-auto block w-full max-w-[20rem] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-raised)] md:max-w-none"
          >
            <Cover drink={drink} size="full" eager />
          </button>
          <PhotoStrip
            drink={drink}
            photos={bottlePhotos}
            onOpen={(index) => setGallery({ photos: bottlePhotos, start: index })}
          />
        </div>

        <div className="mt-5 min-w-0 md:mt-0">
          <Headline drink={drink} />
          <RatingPanel drink={drink} data={data} onLog={() => setTasting('new')} />
          <Cellar drink={drink} />
          <Facts drink={drink} />

          {drink.labelText ? (
            <Section title={t.backLabel}>
              <blockquote className="relative rounded-[1.5rem] bg-white p-5 pl-12 shadow-[var(--shadow-xs)]">
                <QuoteIcon
                  aria-hidden="true"
                  fontSize="inherit"
                  className="absolute left-4 top-4 text-[1.5rem] text-ink-300"
                />
                <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-800">
                  {drink.labelText}
                </p>
              </blockquote>
            </Section>
          ) : null}
          {drink.notes ? (
            <Section title={t.notes}>
              <p className="whitespace-pre-line rounded-[1.5rem] bg-white p-5 text-[0.9375rem] leading-relaxed text-ink-800 shadow-[var(--shadow-xs)]">
                {drink.notes}
              </p>
            </Section>
          ) : null}

          <Section
            title={t.tastings}
            aside={tastings.length ? t.tastingsCount(tastings.length) : undefined}
          >
            {tastings.length ? (
              <ol className="flex flex-col gap-3">
                {tastings.map((entry) => (
                  <TastingCard
                    key={entry.id}
                    tasting={entry}
                    drink={drink}
                    people={people}
                    onEdit={() => setTasting(entry)}
                    onPhotos={(start) =>
                      setGallery({
                        photos: entry.photos.map((p) => ({ ...p, tastingId: entry.id })),
                        start,
                      })
                    }
                  />
                ))}
              </ol>
            ) : (
              <button
                type="button"
                onClick={() => setTasting('new')}
                className="press w-full rounded-[1.5rem] border-2 border-dashed border-ink-200 p-5 text-left text-sm text-ink-600 hover:bg-white"
              >
                {t.noTastings}
              </button>
            )}
          </Section>

          {insights.people.length > 1 ? (
            <Section title={t.byPerson}>
              <ul className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-xs)]">
                {insights.people.map((person) => {
                  const found = people.find((p) => p.id === person.id);
                  return (
                    <li key={person.id} className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-0">
                      <Avatar person={found ?? { id: person.id, name: person.name, surname: '' }} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{person.name}</span>
                        <span className="block text-xs text-ink-500">
                          {t.tastingsCount(person.tastings)} · {formatDate(person.last)}
                        </span>
                      </span>
                      {person.rating !== null ? (
                        <span className="tabular flex items-center gap-1.5 text-sm font-bold">
                          <Stars value={Math.round(person.rating)} size="xs" />
                          {stars(person.rating)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}

          {prices.length ? (
            <Section title={t.priceHistory}>
              <ol className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-xs)]">
                {[...prices].reverse().map((point, index, list) => {
                  const older = list[index + 1];
                  const change =
                    older && older.currency === point.currency ? point.price - older.price : 0;
                  return (
                    <li key={point.id} className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-0">
                      <span className="min-w-0 flex-1">
                        <span className="tabular block font-semibold">{money(point.price, point.currency)}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {[formatDate(point.boughtOn), point.boughtAt].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {change ? (
                        <span
                          className={cx(
                            'tabular rounded-pill px-2 py-0.5 text-xs font-bold',
                            change > 0 ? 'bg-peach-100 text-peach-800' : 'bg-mint-100 text-mint-800',
                          )}
                        >
                          {change > 0 ? '+' : '−'}
                          {money(Math.abs(change), point.currency)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Section>
          ) : null}
        </div>
      </div>

      {family.length ? (
        <Section title={t.family(drink.line)}>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0">
            {family.map((other, index) => (
              <li key={other.id} className="w-[9.5rem] shrink-0">
                <DrinkCard drink={other} index={index} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <TastingSheet
        open={tasting !== null}
        onClose={() => setTasting(null)}
        drink={drink}
        people={people}
        tasting={tasting === 'new' ? null : tasting}
      />
      <Gallery
        key={gallery ? `${gallery.photos[0]?.id}-${gallery.start}` : 'closed'}
        photos={gallery?.photos ?? []}
        start={gallery ? gallery.start : null}
        onClose={() => setGallery(null)}
        onCover={(photo) => cover.mutate(photo)}
        onDelete={(photo) => removePhoto.mutate(photo)}
      />
    </>
  );
}

/** The name large, who made it, and the few words that say what it is. */
function Headline({ drink }: { drink: Drink }) {
  const t = useDrinksT();
  const chips = [
    t.category[drink.category],
    drink.color ? t.color[drink.color] : null,
    drink.style || null,
    drink.vintage ? String(drink.vintage) : null,
    drink.ageYears !== null ? t.years(drink.ageYears) : null,
  ].filter((c): c is string => Boolean(c));
  return (
    <header>
      {drink.producer ? (
        <p className="text-sm font-semibold text-ink-500">{drink.producer}</p>
      ) : null}
      <h2 className="mt-0.5 text-[1.75rem] font-bold leading-[1.1] tracking-[-0.025em] text-balance">
        {drink.name}
      </h2>
      <ul className="mt-2.5 flex flex-wrap gap-1">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-pill bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-[var(--shadow-xs)]"
          >
            {chip}
          </li>
        ))}
        {drink.country ? (
          <li className="inline-flex items-center gap-1 rounded-pill bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-[var(--shadow-xs)]">
            <PlaceIcon fontSize="inherit" className="text-ink-400" />
            {[drink.region, countryName(drink.country)].filter(Boolean).join(', ')}
          </li>
        ) : null}
      </ul>
    </header>
  );
}

/** What everyone thought, in one card, and the one thing to do next: log a tasting. */
function RatingPanel({ drink, data, onLog }: { drink: Drink; data: DrinkDetail; onLog: () => void }) {
  const t = useDrinksT();
  const { insights } = data;
  return (
    <section className="mt-5 overflow-hidden rounded-[1.75rem] bg-ink-900 p-5 text-white shadow-[var(--shadow-raised)]">
      {insights.rating !== null ? (
        <div className="flex items-end gap-4">
          <p className="tabular text-[3.25rem] font-bold leading-[0.9] tracking-[-0.05em]">
            {stars(insights.rating)}
          </p>
          <div className="min-w-0 pb-1">
            <Stars value={Math.round(insights.rating)} size="sm" className="[&_.text-ink-200]:text-white/20" />
            <p className="mt-0.5 truncate text-sm text-white/70">
              {[
                t.avg,
                t.tastingsCount(insights.tastings),
                insights.lastTasted ? t.lastTasted(formatDate(insights.lastTasted)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[0.9375rem] text-white/75">
          {insights.tastings ? t.tastingsCount(insights.tastings) : t.notTasted}
        </p>
      )}
      {drink.myRating !== null || insights.buyAgain ? (
        <p className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
          {drink.myRating !== null ? (
            <span className="rounded-pill bg-white/10 px-2.5 py-1">
              {t.you}: {stars(drink.myRating)}★
            </span>
          ) : null}
          {insights.buyAgain ? (
            <span className="rounded-pill bg-white/10 px-2.5 py-1">
              {t.wouldBuyAgain(insights.buyAgain.yes, insights.buyAgain.of)}
            </span>
          ) : null}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          onLog();
        }}
        className="press mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-butter-300 px-5 text-[0.9375rem] font-semibold text-ink-900 sm:w-auto"
      >
        <WineBarIcon fontSize="inherit" className="text-xl" />
        {t.logTasting}
      </button>
    </section>
  );
}

/** At home: how many, where, open or not, wanted; one tap for a bottle more or less. */
function Cellar({ drink }: { drink: Drink }) {
  const t = useDrinksT();
  const client = useQueryClient();
  const [location, setLocation] = useState(drink.location);
  const change = useMutation({
    mutationFn: (patch: Parameters<typeof drinksApi.stock>[1]) => drinksApi.stock(drink.id, patch),
    onMutate: (patch) => {
      // The count moves at once; the server's answer replaces it.
      client.setQueryData<DrinkDetail>(drinksKeys.drink(drink.id), (old) =>
        old
          ? {
              ...old,
              drink: {
                ...old.drink,
                ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
                ...(patch.opened !== undefined ? { opened: patch.opened } : {}),
                ...(patch.wanted !== undefined ? { wanted: patch.wanted } : {}),
              },
            }
          : old,
      );
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: drinksKeys.all }),
  });
  return (
    <Section title={t.cellar}>
      <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-xs)]">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[0.9375rem] font-semibold">
              {drink.stock ? t.bottles(drink.stock) : t.cellarNone}
            </span>
            <span className="block truncate text-xs text-ink-500">
              {[
                drink.location || null,
                drink.boughtOn ? t.boughtOn(formatDate(drink.boughtOn)) : null,
                drink.price !== null ? money(drink.price, drink.currency) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <Stepper
            value={drink.stock}
            onChange={(stock) => change.mutate({ stock })}
            less={t.removeBottle}
            more={t.addBottle}
          />
        </div>
        {drink.stock > 0 ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.8125rem] font-semibold text-ink-700">{t.where}</span>
              <input
                value={location}
                maxLength={80}
                placeholder={t.wherePlaceholder}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => {
                  if (location.trim() !== drink.location) change.mutate({ location: location.trim() });
                }}
                className="h-11 rounded-[0.875rem] bg-ink-50 px-4 text-[0.9375rem] outline-none hover:bg-ink-100 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
              />
            </label>
            <Switch
              checked={drink.opened}
              onChange={(opened) => change.mutate({ opened })}
              label={t.isOpen}
            />
          </>
        ) : null}
        <Switch
          checked={drink.wanted}
          onChange={(wanted) => change.mutate({ wanted })}
          label={t.wantToTry}
          hint={t.wantToTryHint}
        />
      </div>
    </Section>
  );
}

/** Every fact the label gave, as a two-column list; empty ones stay out. */
function Facts({ drink }: { drink: Drink }) {
  const t = useDrinksT();
  const rows: [string, ReactNode][] = (
    [
      [t.fact.producer, drink.producer],
      [t.fact.line, drink.line],
      [t.fact.variant, drink.variant],
      [t.fact.vintage, drink.vintage],
      [t.fact.ageYears, drink.ageYears !== null ? t.years(drink.ageYears) : null],
      [t.fact.abv, drink.abv !== null ? t.abv(String(drink.abv)) : null],
      [t.fact.volumeMl, drink.volumeMl !== null ? t.ml(String(drink.volumeMl)) : null],
      [t.fact.country, countryName(drink.country)],
      [t.fact.region, drink.region],
      [t.fact.appellation, drink.appellation],
      [t.fact.grapes, drink.grapes.join(', ')],
      [t.fact.style, drink.style],
      [t.fact.cask, drink.cask],
      [t.fact.producedOn, drink.producedOn ? formatDate(drink.producedOn) : null],
      [t.fact.tags, drink.tags.map((tag) => `#${tag}`).join(' ')],
    ] as [string, ReactNode][]
  ).filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!rows.length) return null;
  return (
    <Section title={t.facts}>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] bg-ink-100 shadow-[var(--shadow-xs)]">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold text-ink-500">{label}</dt>
            <dd className="tabular mt-0.5 break-words text-[0.9375rem] font-semibold text-ink-900">{value}</dd>
          </div>
        ))}
        {rows.length % 2 ? <div aria-hidden="true" className="bg-white" /> : null}
      </dl>
    </Section>
  );
}

/** The bottle's photos under the cover, and the tile that adds the next one (front, back, more). */
function PhotoStrip({
  drink,
  photos,
  onOpen,
}: {
  drink: Drink;
  photos: Photo[];
  onOpen: (index: number) => void;
}) {
  const t = useDrinksT();
  const client = useQueryClient();
  const next: PhotoKind = !photos.length ? 'front' : !photos.some((p) => p.kind === 'back') ? 'back' : 'other';
  const add = useMutation({
    mutationFn: async (file: File) => drinksApi.addPhoto(drink.id, await photoForUpload(file), next),
    onSuccess: () => toast.success(t.photoAdded),
    onError: (error) =>
      toast.error(t.photoFailed, {
        description: error instanceof PhotoTooLarge ? undefined : errorMessage(error),
      }),
    onSettled: () => client.invalidateQueries({ queryKey: drinksKeys.all }),
  });
  return (
    <ul className="mx-auto mt-3 flex max-w-[20rem] gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:max-w-none">
      {photos.map((photo, index) => (
        <li key={photo.id} className="shrink-0">
          <button
            type="button"
            aria-label={`${t.photoKind[photo.kind]} ${t.photoOf(index + 1, photos.length)}`}
            onClick={() => onOpen(index)}
            className="press block size-16 overflow-hidden rounded-2xl bg-ink-100 shadow-[var(--shadow-xs)]"
          >
            <img src={photo.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
          </button>
        </li>
      ))}
      <li className="shrink-0">
        <label
          className={cx(
            'press flex h-16 cursor-pointer items-center gap-2 rounded-2xl bg-white px-3.5 text-left shadow-[var(--shadow-xs)] hover:bg-ink-50',
            add.isPending && 'pointer-events-none opacity-60',
          )}
        >
          <AddPhotoIcon fontSize="inherit" className="text-[1.4rem] text-ink-600" />
          <span className="text-[0.8125rem] font-semibold leading-tight text-ink-800">
            {add.isPending ? t.uploading : next === 'other' ? t.addPhoto : t.photoKind[next]}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={add.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) add.mutate(file);
            }}
          />
        </label>
      </li>
    </ul>
  );
}

/** One tasting: who, when and where, the stars, their words, the photos, and the sheet folded. */
function TastingCard({
  tasting,
  drink,
  people,
  onEdit,
  onPhotos,
}: {
  tasting: Tasting;
  drink: Drink;
  people: DrinkPerson[];
  onEdit: () => void;
  onPhotos: (start: number) => void;
}) {
  const t = useDrinksT();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const person = people.find((p) => p.id === tasting.person.id);
  const companions = [
    ...tasting.withPeople.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean),
    tasting.withOthers || null,
  ].filter(Boolean) as string[];
  const where = [tasting.place, tasting.occasion, countryName(tasting.country)].filter(Boolean).join(' · ');
  const quickAromas =
    tasting.mode === 'quick' && tasting.sheet
      ? tasting.sheet.kind === 'beer'
        ? (tasting.sheet.aromas ?? [])
        : (tasting.sheet.nose?.aromas ?? [])
      : [];
  const addPhoto = useMutation({
    mutationFn: async (file: File) =>
      drinksApi.addPhoto(drink.id, await photoForUpload(file), 'other', tasting.id),
    onSuccess: () => toast.success(t.photoAdded),
    onError: (error) => toast.error(t.photoFailed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: drinksKeys.all }),
  });

  return (
    <li className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start gap-3">
        <Avatar person={person ?? { id: tasting.person.id, name: tasting.person.name, surname: '' }} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{tasting.person.name}</span>
            <span className="tabular text-sm text-ink-500">{formatDate(tasting.tastedOn)}</span>
          </p>
          {where || companions.length ? (
            <p className="mt-0.5 text-sm text-ink-600">
              {[where, companions.length ? t.withNames(companions.join(', ')) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <Stars value={tasting.rating} size="sm" />
          {tasting.score !== null ? (
            <span className="tabular text-xs font-bold text-ink-600">{tasting.score}/100</span>
          ) : null}
        </div>
      </div>

      {tasting.comment ? (
        <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-800">
          {tasting.comment}
        </p>
      ) : null}
      {quickAromas.length ? (
        <ul className="mt-2.5 flex flex-wrap gap-1">
          {quickAromas.map((id) => (
            <li key={id} className="rounded-pill bg-pink-100 px-2.5 py-1 text-[0.8125rem] font-semibold text-pink-800">
              {t.aroma[id] ?? id}
            </li>
          ))}
        </ul>
      ) : null}
      {tasting.pairing || tasting.buyAgain !== null ? (
        <p className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-semibold">
          {tasting.pairing ? (
            <span className="rounded-pill bg-ink-50 px-2.5 py-1 text-ink-700">
              {t.pairing}: {tasting.pairing}
            </span>
          ) : null}
          {tasting.buyAgain !== null ? (
            <span
              className={cx(
                'rounded-pill px-2.5 py-1',
                tasting.buyAgain ? 'bg-mint-100 text-mint-800' : 'bg-ink-50 text-ink-600',
              )}
            >
              {t.buyAgain} {tasting.buyAgain ? t.yes : t.no}
            </span>
          ) : null}
        </p>
      ) : null}

      {tasting.photos.length ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {tasting.photos.map((photo, index) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                aria-label={t.openGallery}
                onClick={() => onPhotos(index)}
                className="press block size-20 overflow-hidden rounded-2xl bg-ink-100"
              >
                <img src={photo.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {tasting.mode === 'full' && tasting.sheet ? (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="press flex w-full items-center justify-between rounded-2xl bg-ink-50 px-3.5 py-2.5 text-left text-sm font-semibold"
          >
            {t.theSheet}
            <ExpandMoreIcon
              fontSize="inherit"
              className={cx('text-xl text-ink-500 transition-transform', open && 'rotate-180')}
            />
          </button>
          {open ? (
            <div className="animate-rise px-1 pt-3">
              <SheetSummary sheet={tasting.sheet} />
            </div>
          ) : null}
        </div>
      ) : null}

      {tasting.mine ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="tint" icon={EditIcon} onClick={onEdit}>
            {t.edit}
          </Button>
          <label
            className={cx(
              'press inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-pill bg-ink-50 px-4 text-sm font-semibold text-ink-800 hover:bg-ink-100',
              addPhoto.isPending && 'pointer-events-none opacity-60',
            )}
          >
            <AddPhotoIcon fontSize="inherit" className="text-base" />
            {addPhoto.isPending ? t.uploading : t.addPhoto}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) addPhoto.mutate(file);
              }}
            />
          </label>
        </div>
      ) : null}
    </li>
  );
}
