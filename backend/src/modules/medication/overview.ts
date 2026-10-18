import type { FoodCtx } from '../food/kitchen';
import { householdPeople } from '../drinks/drinks';
import {
  availableOf,
  findMedicine,
  listMedicines,
  listPackages,
  placeNames,
  todayOf,
  type Package,
} from './cabinet';
import { intake, nextDose } from './doses';
import { medicinePhotos } from './photos';
import type { ListQuery } from './schemas';
import { listTreatments } from './treatments';

/** The cabinet as the app shows it: medicines with their stock, chips, the counts for the card. */

export async function summary(ctx: FoodCtx) {
  const today = todayOf(ctx);
  const [packages, treatments, next] = await Promise.all([
    listPackages(ctx),
    listTreatments(ctx),
    nextDose(ctx),
  ]);
  const expiring = packages.filter((p) => p.status === 'ok' && p.expiry.state === 'soon').length;
  const expired = packages.filter((p) => p.status === 'expired').length;
  const low = new Set(treatments.filter((t) => t.low).map((t) => t.medicineId)).size;
  return {
    today,
    expiring,
    expired,
    low,
    /** The home card's badge: what needs a look in the cabinet. */
    badge: expiring + expired,
    next: next
      ? {
          id: next.id,
          medicineName: next.medicineName,
          personName: next.personName,
          dueOn: next.dueOn,
          dueTime: next.dueTime,
          state: next.state,
        }
      : null,
  };
}

const inUse = (p: Package) => p.status === 'ok' || p.status === 'expired';

export async function cabinet(ctx: FoodCtx, query: ListQuery = {}) {
  const today = todayOf(ctx);
  const [medicines, packages, treatments, people, places] = await Promise.all([
    listMedicines(ctx),
    listPackages(ctx),
    listTreatments(ctx),
    householdPeople(ctx),
    placeNames(ctx),
  ]);
  const lowIds = new Set(treatments.filter((t) => t.low).map((t) => t.medicineId));
  const all = medicines.map((medicine) => {
    const own = packages.filter((p) => p.medicineId === medicine.id);
    const live = own.filter(inUse);
    const expired = live.filter((p) => p.status === 'expired').length;
    const soon = live.filter((p) => p.expiry.state === 'soon').length;
    return {
      ...medicine,
      packages: live,
      available: availableOf(own, today),
      expiredPackages: expired,
      soonPackages: soon,
      state: !live.length ? ('none' as const) : expired ? ('expired' as const) : soon ? ('soon' as const) : ('ok' as const),
      low: lowIds.has(medicine.id),
      treating: treatments.filter((t) => t.medicineId === medicine.id && t.status === 'active').length,
    };
  });

  const words = (query.q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const searched = all.filter((m) => {
    const haystack = `${m.name} ${m.substance} ${m.strength} ${m.form} ${m.notes} ${m.packages.map((p) => `${p.place} ${p.batch}`).join(' ')}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
  const counts = {
    all: searched.length,
    expiring: searched.filter((m) => m.soonPackages > 0).length,
    expired: searched.filter((m) => m.expiredPackages > 0).length,
    low: searched.filter((m) => m.low).length,
  };
  const filtered = searched.filter((m) => {
    if (query.place && !m.packages.some((p) => p.place === query.place)) return false;
    if (query.filter === 'expiring') return m.soonPackages > 0;
    if (query.filter === 'expired') return m.expiredPackages > 0;
    if (query.filter === 'low') return m.low;
    return true;
  });
  return {
    medicines: filtered,
    counts,
    people,
    places,
    summary: await summary(ctx),
  };
}

export async function medicineDetail(ctx: FoodCtx, id: string) {
  const medicine = await findMedicine(ctx, id);
  const today = todayOf(ctx);
  const [packages, photos, treatments] = await Promise.all([
    listPackages(ctx, [id]),
    medicinePhotos(ctx, id),
    listTreatments(ctx),
  ]);
  const mine = treatments.filter((t) => t.medicineId === id);
  const history = (await intake(ctx, {})).doses.filter(
    (d) => d.medicineId === id && (d.state === 'taken' || d.state === 'skipped' || d.state === 'missed'),
  );
  return {
    medicine,
    packages,
    available: availableOf(packages, today),
    photos,
    treatments: mine,
    history: history.slice(0, 60),
  };
}
