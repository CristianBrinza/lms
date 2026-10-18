import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Button, IconButton, Sheet, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, EditIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { closetApi, closetKeys, type Place, type PlaceKind, type Side } from '../api';
import { SECTION_KINDS } from '../catalog';
import { ClosetScreen, ErrorCard, Field, Hanger, PickOne, Studio } from '../components/parts';
import { useClosetT } from '../i18n';
import { childrenOf, placeName } from '../places';

type Editing =
  | { mode: 'new'; kind: 'room' | 'furniture' | 'section'; parentId: string | null }
  | { mode: 'edit'; place: Place };

/**
 * The closet map: rooms as cards, the furniture in them, and each piece of furniture drawn as its
 * sections — shelves stacked as on the wall (shelf 1 at the bottom), rails, drawers, boxes — each
 * with how many pieces it holds. Tap a section to see what's there.
 */
export default function PlacesPage() {
  const t = useClosetT();
  const query = useQuery({ queryKey: closetKeys.overview('all'), queryFn: () => closetApi.overview('all') });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [open, setOpen] = useState<Place | null>(null);
  const places = query.data?.places ?? [];
  const rooms = childrenOf(places, null);

  return (
    <ClosetScreen
      wide
      nav
      back="/closet"
      title={t.placesTitle}
      subtitle={t.placesIntro}
      actions={
        <IconButton
          icon={AddIcon}
          label={t.addRoom}
          variant="ink"
          onClick={() => setEditing({ mode: 'new', kind: 'room', parentId: null })}
        />
      }
    >
      {query.isPending ? (
        <Skeleton className="h-64 rounded-[1.75rem]" />
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : !rooms.length ? (
        <section className="rounded-[1.75rem] bg-white p-6 shadow-[var(--shadow-card)]">
          <Hanger className="h-14 w-auto text-ink-300" />
          <p className="mt-4 max-w-prose text-[0.9375rem] text-ink-700">{t.placesEmpty}</p>
          <Button className="mt-5" icon={AddIcon} onClick={() => setEditing({ mode: 'new', kind: 'room', parentId: null })}>
            {t.addRoom}
          </Button>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.map((room) => (
            <section key={room.id} className="rounded-[1.75rem] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
              <header className="flex items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-[1.25rem] font-bold tracking-[-0.015em]">{placeName(room)}</h2>
                <IconButton icon={EditIcon} label={t.edit} variant="ghost" size="sm" onClick={() => setEditing({ mode: 'edit', place: room })} />
              </header>
              <div className="mt-3 flex flex-col gap-3">
                {childrenOf(places, room.id).map((piece) =>
                  piece.kind === 'furniture' ? (
                    <Furniture
                      key={piece.id}
                      furniture={piece}
                      places={places}
                      onEdit={(place) => setEditing({ mode: 'edit', place })}
                      onAdd={() => setEditing({ mode: 'new', kind: 'section', parentId: piece.id })}
                      onOpen={setOpen}
                    />
                  ) : (
                    <Band key={piece.id} place={piece} onOpen={setOpen} onEdit={() => setEditing({ mode: 'edit', place: piece })} />
                  ),
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="tint" icon={AddIcon} onClick={() => setEditing({ mode: 'new', kind: 'furniture', parentId: room.id })}>
                  {t.addFurniture}
                </Button>
                {room.items ? (
                  <Button size="sm" variant="ghost" onClick={() => setOpen(room)}>
                    {t.inside(room.items)}
                  </Button>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing ? <PlaceSheet editing={editing} onClose={() => setEditing(null)} /> : null}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? placeName(open) : ''}>
        {open ? (
          <ul className="grid grid-cols-3 gap-2.5">
            {(query.data?.items ?? [])
              .filter((i) => i.placeId === open.id)
              .map((item) => (
                <li key={item.id}>
                  <Link to={`/closet/${item.id}`} className="press block">
                    <Studio cover={item.cover} alt={item.name} className="aspect-[4/5] rounded-2xl" />
                    <span className="mt-1 block truncate text-xs font-semibold text-ink-800">{item.name}</span>
                  </Link>
                </li>
              ))}
          </ul>
        ) : null}
      </Sheet>
    </ClosetScreen>
  );
}

/** A piece of furniture drawn as its sections, top to bottom as they stand. */
function Furniture({
  furniture,
  places,
  onEdit,
  onAdd,
  onOpen,
}: {
  furniture: Place;
  places: Place[];
  onEdit: (place: Place) => void;
  onAdd: () => void;
  onOpen: (place: Place) => void;
}) {
  const t = useClosetT();
  const sections = childrenOf(places, furniture.id);
  return (
    <div className="rounded-3xl bg-ink-50 p-3">
      <div className="flex items-center gap-2 px-1">
        <h3 className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">{placeName(furniture)}</h3>
        <IconButton icon={EditIcon} label={t.edit} variant="ghost" size="sm" onClick={() => onEdit(furniture)} />
      </div>
      {/* The frame: a hairline cabinet, sections as bands inside. */}
      <div className="mt-2 rounded-2xl border-2 border-ink-200 bg-white p-1.5">
        {sections.length ? (
          <div className="flex flex-col gap-1.5">
            {sections.map((section) => (
              <Band key={section.id} place={section} onOpen={onOpen} onEdit={() => onEdit(section)} />
            ))}
          </div>
        ) : (
          <p className="px-2 py-3 text-sm text-ink-500">{t.shelfFromBottom}</p>
        )}
      </div>
      <Button size="sm" variant="ghost" icon={AddIcon} className="mt-2" onClick={onAdd}>
        {t.addSection}
      </Button>
    </div>
  );
}

const BAND_LOOK: Partial<Record<PlaceKind, string>> = {
  shelf: 'h-12 border-b-[3px] border-ink-300',
  rail: 'h-16',
  drawer: 'h-12 rounded-xl bg-ink-50',
  box: 'h-12 rounded-xl bg-butter-50',
  hook: 'h-11',
  section: 'h-12',
};

function Band({ place, onOpen, onEdit }: { place: Place; onOpen: (place: Place) => void; onEdit: () => void }) {
  const t = useClosetT();
  return (
    <div className={cx('relative flex items-center gap-2 px-3', BAND_LOOK[place.kind] ?? 'h-12')}>
      {place.kind === 'rail' ? (
        <span aria-hidden="true" className="absolute inset-x-3 top-3 h-[3px] rounded-pill bg-ink-400" />
      ) : null}
      {place.kind === 'drawer' ? (
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-ink-300" />
      ) : null}
      <button type="button" onClick={() => onOpen(place)} className="press relative z-[1] flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
        <span className="truncate text-sm font-semibold text-ink-900">{placeName(place)}</span>
        <span className={cx('tabular shrink-0 rounded-pill px-2 py-0.5 text-xs font-bold', place.items ? 'bg-ink-900 text-white' : 'text-ink-400')}>
          {place.items}
        </span>
      </button>
      <button type="button" aria-label={t.edit} onClick={onEdit} className="press relative z-[1] grid size-8 place-items-center rounded-full text-base text-ink-500 hover:bg-ink-100">
        <EditIcon fontSize="inherit" />
      </button>
    </div>
  );
}

function PlaceSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const t = useClosetT();
  const queryClient = useQueryClient();
  const base = editing.mode === 'edit' ? editing.place : null;
  const group: 'room' | 'furniture' | 'section' =
    editing.mode === 'new' ? editing.kind : base!.kind === 'room' || base!.kind === 'furniture' ? base!.kind : 'section';
  const [kind, setKind] = useState<PlaceKind>(base?.kind ?? (group === 'section' ? 'shelf' : group));
  const [name, setName] = useState(base?.name ?? '');
  const [number, setNumber] = useState(base?.number ? String(base.number) : '');
  const [side, setSide] = useState<Side>(base?.side ?? '');
  const [confirm, setConfirm] = useState(false);
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: closetKeys.all });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const n = Number.parseInt(number, 10);
      const fields = {
        kind,
        name: name.trim(),
        number: group === 'section' && Number.isFinite(n) ? Math.max(1, Math.min(99, n)) : null,
        side: group === 'section' ? side : ('' as Side),
      };
      return editing.mode === 'edit'
        ? closetApi.updatePlace(editing.place.id, fields)
        : closetApi.addPlace({ ...fields, parentId: editing.parentId });
    },
    onSuccess: done,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => closetApi.removePlace(base!.id),
    onSuccess: done,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const title =
    editing.mode === 'edit' ? placeName(editing.place) : group === 'room' ? t.addRoom : group === 'furniture' ? t.addFurniture : t.addSection;
  const needsName = group !== 'section';

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={title}
        footer={
          <div className="flex flex-col gap-2.5">
            <Button fullWidth loading={save.isPending} disabled={needsName && !name.trim()} onClick={() => save.mutate()}>
              {t.save}
            </Button>
            {base ? (
              <Button fullWidth variant="ghost" className="text-danger-700" onClick={() => setConfirm(true)}>
                {t.delete}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {group === 'section' ? (
            <>
              <Field label={t.category_} hint={kind === 'shelf' ? t.shelfFromBottom : kind === 'drawer' ? t.drawerFromTop : undefined}>
                <PickOne label={t.category_} options={SECTION_KINDS} value={kind} clearable={false} word={(k) => t.placeKind[k]} onChange={(k) => k && setKind(k)} />
              </Field>
              {kind === 'shelf' || kind === 'drawer' || kind === 'box' || kind === 'hook' ? (
                <TextField label={t.number} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 2))} />
              ) : null}
              <Field label={t.sideLabel}>
                <PickOne
                  label={t.sideLabel}
                  options={['left', 'middle', 'right'] as const}
                  value={side}
                  word={(s) => t.side[s] ?? s}
                  onChange={(s) => setSide(s)}
                />
              </Field>
              <TextField label={t.sectionName} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </>
          ) : (
            <TextField
              label={group === 'room' ? t.roomName : t.furnitureName}
              placeholder={group === 'room' ? t.roomPlaceholder : t.furniturePlaceholder}
              value={name}
              maxLength={80}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
        title={t.deletePlace}
        description={t.deletePlaceBody}
        confirmLabel={t.delete}
        tone="danger"
        loading={remove.isPending}
      />
    </>
  );
}
