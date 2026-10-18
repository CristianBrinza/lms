import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Button, ButtonLink, IconButton, ListGroup, ListRowButton, Sheet, Skeleton, toast } from '@/components/ui';
import { AddPhotoIcon, DeleteIcon, EditIcon, MoreHorizIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { Gallery } from '@/drinks/components/Gallery';
import { photoForUpload, PhotoTooLarge } from '@/drinks/images';
import { medicationApi, medicationKeys, type MedicineDetail, type Package, type Treatment } from '../api';
import { PackageLine } from '../components/CabinetList';
import { IntakeList } from '../components/IntakeList';
import { MedicineSheet } from '../components/MedicineSheet';
import { PackageSheet } from '../components/PackageSheet';
import { Disclaimer, ErrorCard, MedScreen, Section } from '../components/parts';
import { weekdayShort } from '../logic';
import { TreatmentSheet } from '../components/TreatmentSheet';
import { useMedicationT } from '../i18n';

/** One medicine: its photos, packages with expiry chips and counts, treatments and the intake history. */
export default function MedicinePage() {
  const { id = '' } = useParams();
  const t = useMedicationT();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: medicationKeys.medicine(id), queryFn: () => medicationApi.medicine(id) });
  const cabinet = useQuery({
    queryKey: medicationKeys.cabinet('', 'all'),
    queryFn: () => medicationApi.cabinet('', 'all'),
  });
  const data = query.data;
  const medicine = data?.medicine;
  const people = cabinet.data?.people ?? [];
  const places = cabinet.data?.places ?? [];

  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [packageSheet, setPackageSheet] = useState<{ pkg: Package | null } | null>(null);
  const [starting, setStarting] = useState<Treatment | 'new' | null>(null);

  const remove = useMutation({
    mutationFn: () => medicationApi.removeMedicine(id),
    onSuccess: () => {
      toast.success(t.removed);
      navigate('/medication', { replace: true });
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });

  return (
    <MedScreen
      title={medicine?.name ?? ' '}
      subtitle={medicine ? [medicine.strength, t.form[medicine.form]].filter(Boolean).join(' · ') : ' '}
      actions={
        medicine ? (
          <>
            <IconButton icon={EditIcon} label={t.edit} variant="white" onClick={() => setEditing(true)} />
            <IconButton icon={MoreHorizIcon} label={t.more} variant="white" onClick={() => setMenu(true)} />
          </>
        ) : null
      }
    >
      {query.isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : data && medicine ? (
        <>
          <Body
            data={data}
            onEditPackage={(pkg) => setPackageSheet({ pkg })}
            onAddPackage={() => setPackageSheet({ pkg: null })}
            onStart={() => setStarting('new')}
            onEditTreatment={(treatment) => setStarting(treatment)}
          />
          <MedicineSheet
            open={editing}
            onClose={() => setEditing(false)}
            medicine={medicine}
            people={people}
            places={places}
          />
          <PackageSheet
            open={Boolean(packageSheet)}
            onClose={() => setPackageSheet(null)}
            medicine={medicine}
            pkg={packageSheet?.pkg}
            places={places}
          />
          <TreatmentSheet
            open={Boolean(starting)}
            onClose={() => setStarting(null)}
            treatment={starting && starting !== 'new' ? starting : null}
            medicine={medicine}
            medicines={[medicine]}
            people={people}
          />
          <Sheet open={menu} onClose={() => setMenu(false)} title={medicine.name}>
            <ListGroup>
              <ListRowButton
                icon={DeleteIcon}
                tone="danger"
                label={t.deleteMedicine}
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
            title={t.deleteMedicine}
            description={t.deleteMedicineConfirm(medicine.name)}
            confirmLabel={t.delete}
            tone="danger"
            loading={remove.isPending}
          />
        </>
      ) : (
        <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="font-semibold">{t.notFound}</p>
          <ButtonLink to="/medication" size="sm" variant="tint" className="mt-3">
            {t.backToCabinet}
          </ButtonLink>
        </div>
      )}
      <Disclaimer />
    </MedScreen>
  );
}

function Body({
  data,
  onEditPackage,
  onAddPackage,
  onStart,
  onEditTreatment,
}: {
  data: MedicineDetail;
  onEditPackage: (pkg: Package) => void;
  onAddPackage: () => void;
  onStart: () => void;
  onEditTreatment: (treatment: Treatment) => void;
}) {
  const t = useMedicationT();
  const client = useQueryClient();
  const { medicine, packages, photos, treatments, history } = data;
  const [open, setOpen] = useState<number | null>(null);
  const live = packages.filter((p) => p.status === 'ok' || p.status === 'expired');
  const past = packages.filter((p) => p.status === 'finished' || p.status === 'discarded');

  const upload = useMutation({
    mutationFn: async (file: File) =>
      medicationApi.addPhoto(medicine.id, await photoForUpload(file), photos.length ? 'other' : 'front'),
    onSuccess: () => haptic('success'),
    onError: (error) =>
      toast.error(t.photoFailed, { description: error instanceof PhotoTooLarge ? undefined : errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });
  const removePhoto = useMutation({
    mutationFn: (photoId: string) => medicationApi.removePhoto(photoId),
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });
  const cover = useMutation({
    mutationFn: (photoId: string) => medicationApi.updatePhoto(photoId, { cover: true }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });

  return (
    <>
      <Section title={t.photosTitle} className="mt-2">
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpen(index)}
              className="press relative size-28 shrink-0 overflow-hidden rounded-[1.25rem] bg-ink-100 shadow-[var(--shadow-card)]"
            >
              <img src={photo.thumb} alt={t.photoKind[photo.kind]} className="size-full object-cover" />
              <span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-pill bg-white/90 px-2 py-0.5 text-xs font-semibold">
                {t.photoKind[photo.kind]}
              </span>
            </button>
          ))}
          <label
            className={cx(
              'press grid size-28 shrink-0 cursor-pointer place-items-center rounded-[1.25rem] bg-white text-center ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
              upload.isPending && 'opacity-60',
            )}
          >
            <span className="flex flex-col items-center gap-1 px-2 text-[0.8125rem] font-semibold text-ink-700">
              <AddPhotoIcon fontSize="inherit" className="text-[1.75rem] text-ink-500" />
              {t.addPhoto}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </Section>
      <Gallery
        key={open ?? 'closed'}
        photos={photos.map((p) => ({ id: p.id, thumb: p.thumb, full: p.full }))}
        start={open}
        onClose={() => setOpen(null)}
        onCover={(photo) => cover.mutate(photo.id)}
        onDelete={(photo) => {
          setOpen(null);
          removePhoto.mutate(photo.id);
        }}
      />

      {medicine.substance || medicine.notes || medicine.rx ? (
        <p className="mt-4 rounded-3xl bg-white p-4 text-sm text-ink-700 shadow-[var(--shadow-card)]">
          {[medicine.substance, medicine.rx ? 'Rx' : '', medicine.ownerName ?? '']
            .filter(Boolean)
            .join(' · ')}
          {medicine.notes ? <span className="mt-1 block text-ink-600">{medicine.notes}</span> : null}
        </p>
      ) : null}

      <Section
        title={t.packagesTitle}
        aside={t.qty(data.available, medicine.unit, medicine.form)}
      >
        <div className="rounded-3xl bg-white px-4 py-1 shadow-[var(--shadow-card)]">
          <div className="divide-y divide-ink-100">
            {live.map((pkg) => (
              <PackageLine key={pkg.id} pkg={pkg} unit={medicine.unit} form={medicine.form} onEdit={() => onEditPackage(pkg)} />
            ))}
            {past.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between gap-2 py-2 text-sm text-ink-500">
                <span>
                  {t.packageKind[pkg.kind]} · {pkg.status === 'discarded' ? t.discarded : t.none}
                </span>
                <button type="button" className="press font-semibold text-lav-800" onClick={() => onEditPackage(pkg)}>
                  {t.edit}
                </button>
              </div>
            ))}
          </div>
        </div>
        <Button className="mt-3" size="sm" variant="tint" onClick={onAddPackage}>
          {t.addPackage}
        </Button>
      </Section>

      <Section title={t.treatmentsOf}>
        <div className="flex flex-col gap-2">
          {treatments.map((treatment) => (
            <button
              key={treatment.id}
              type="button"
              onClick={() => onEditTreatment(treatment)}
              className="press rounded-3xl bg-white p-4 text-left shadow-[var(--shadow-card)]"
            >
              <span className="block text-sm font-semibold">
                {treatment.personName} · {t.qty(treatment.dose, treatment.unit, treatment.form)}
                {' · '}
                <span className="font-medium text-ink-600">{t.statusLabel[treatment.status]}</span>
              </span>
              <span className="tabular mt-0.5 block text-sm text-ink-600">{t.scheduleText(treatment, weekdayShort)}</span>
            </button>
          ))}
        </div>
        <Button className="mt-3" size="sm" variant="tint" onClick={onStart}>
          {t.addTreatment}
        </Button>
      </Section>

      <Section title={t.intakeTitle}>
        {history.length ? <IntakeList doses={history} /> : <p className="px-1 text-sm text-ink-600">{t.noIntake}</p>}
      </Section>
    </>
  );
}

