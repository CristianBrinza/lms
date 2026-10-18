import { api, query } from '@/services/api/client';

/** /api/medication: the household's medicine cabinet, treatments and the doses taken. */

export const FORMS = ['tablet', 'capsule', 'syrup', 'drops', 'spray', 'cream', 'injection', 'sachet', 'other'] as const;
export type Form = (typeof FORMS)[number];
export const UNITS = ['pcs', 'ml', 'g', 'doses'] as const;
export type Unit = (typeof UNITS)[number];
export const PACKAGE_KINDS = ['box', 'blister', 'bottle', 'tube'] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];
export const INSTRUCTIONS = ['with_food', 'before_food', 'after_food', 'empty_stomach', 'with_water'] as const;
export type Instruction = (typeof INSTRUCTIONS)[number];
export type PhotoKind = 'front' | 'back' | 'blister' | 'leaflet' | 'other';
export type Filter = 'all' | 'expiring' | 'expired' | 'low';
export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired';
export type PackageStatus = 'ok' | 'expired' | 'finished' | 'discarded';
export type DoseState = 'due' | 'taken' | 'skipped' | 'snoozed' | 'missed';
export type ScheduleKind = 'times' | 'interval' | 'prn';
export type EndKind = 'none' | 'date' | 'days' | 'doses';

export interface PhotoRef {
  id: string;
  thumb: string;
  full: string;
}

export interface Photo extends PhotoRef {
  kind: PhotoKind;
  width: number | null;
  height: number | null;
  bytes: number;
  createdAt: string;
}

export interface Package {
  id: string;
  medicineId: string;
  kind: PackageKind;
  quantity: number;
  original: number;
  expiresOn: string | null;
  monthOnly: boolean;
  effectiveExpiry: string | null;
  batch: string;
  openedOn: string | null;
  useWithinDays: number | null;
  place: string;
  status: PackageStatus;
  expiry: { state: ExpiryState; days: number | null };
  createdAt: string;
}

export interface Medicine {
  id: string;
  name: string;
  substance: string;
  strength: string;
  form: Form;
  unit: Unit;
  rx: boolean;
  color: string;
  shape: string;
  notes: string;
  ownerId: string | null;
  ownerName: string | null;
  cover: PhotoRef | null;
  photos: number;
  createdAt: string;
  updatedAt: string;
}

export interface CabinetMedicine extends Medicine {
  packages: Package[];
  available: number;
  expiredPackages: number;
  soonPackages: number;
  state: ExpiryState;
  low: boolean;
  treating: number;
}

export interface Person {
  id: string;
  name: string;
  surname: string;
  avatarUrl: string | null;
}

export interface Summary {
  today: string;
  expiring: number;
  expired: number;
  low: number;
  badge: number;
  next: {
    id: string;
    medicineName: string;
    personName: string;
    dueOn: string;
    dueTime: string | null;
    state: DoseState;
  } | null;
}

export interface Cabinet {
  medicines: CabinetMedicine[];
  counts: Record<Filter, number>;
  people: Person[];
  places: string[];
  summary: Summary;
}

export interface Treatment {
  id: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  form: Form;
  unit: Unit;
  cover: PhotoRef | null;
  personId: string;
  personName: string;
  dose: number;
  kind: ScheduleKind;
  times: string[];
  weekdays: number[];
  intervalHours: number | null;
  maxPerDay: number | null;
  startOn: string;
  endKind: EndKind;
  endOn: string | null;
  endDays: number | null;
  endDoses: number | null;
  courseEnd: string | null;
  stoppedOn: string | null;
  status: 'active' | 'upcoming' | 'finished';
  instructions: Instruction[];
  notes: string;
  lowDays: number;
  available: number;
  dailyUse: number | null;
  daysLeft: number | null;
  low: boolean;
}

export interface Dose {
  id: string;
  treatmentId: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  form: Form;
  unit: Unit;
  instructions: Instruction[];
  personId: string;
  personName: string;
  dueOn: string;
  dueTime: string | null;
  asNeeded: boolean;
  amount: number;
  status: 'due' | 'taken' | 'skipped';
  state: DoseState;
  takenAt: string | null;
  skipReason: string;
  snoozedUntil: string | null;
  shortfall: number;
}

export interface DayView {
  date: string;
  doses: Dose[];
  asNeeded: Array<Treatment & { takenToday: number }>;
}

export interface MedicineDetail {
  medicine: Medicine;
  packages: Package[];
  available: number;
  photos: Photo[];
  treatments: Treatment[];
  history: Dose[];
}

export interface Intake {
  from: string;
  to: string;
  doses: Dose[];
  adherence: number | null;
  byTreatment: Array<{ treatmentId: string; adherence: number | null; taken: number; skipped: number; missed: number }>;
}

export interface DoctorExport extends Intake {
  generatedAt: string;
  treatments: Treatment[];
  history: Dose[];
  note: string;
}

export interface MedicineFields {
  name?: string;
  substance?: string;
  strength?: string;
  form?: Form;
  unit?: Unit;
  rx?: boolean;
  color?: string;
  shape?: string;
  notes?: string;
  ownerId?: string | null;
}

export interface PackageFields {
  kind?: PackageKind;
  quantity?: number;
  original?: number;
  /** A day (YYYY-MM-DD) or, when only the month is printed, YYYY-MM. */
  expiresOn?: string | null;
  batch?: string;
  openedOn?: string | null;
  useWithinDays?: number | null;
  place?: string;
  status?: 'ok' | 'finished' | 'discarded';
}

export interface TreatmentFields {
  medicineId: string;
  personId?: string;
  dose: number;
  kind: ScheduleKind;
  times?: string[];
  weekdays?: number[];
  intervalHours?: number;
  maxPerDay?: number | null;
  startOn?: string;
  endKind?: EndKind;
  endOn?: string | null;
  endDays?: number | null;
  endDoses?: number | null;
  instructions?: Instruction[];
  notes?: string;
  lowDays?: number;
}

export const medicationKeys = {
  all: ['medication'] as const,
  cabinet: (q: string, filter: Filter) => ['medication', 'cabinet', q, filter] as const,
  summary: ['medication', 'summary'] as const,
  today: (date: string) => ['medication', 'today', date] as const,
  treatments: ['medication', 'treatments'] as const,
  medicine: (id: string) => ['medication', 'medicine', id] as const,
  history: (from: string, to: string) => ['medication', 'history', from, to] as const,
  export: ['medication', 'export'] as const,
};

export const medicationApi = {
  cabinet: (q = '', filter: Filter = 'all') =>
    api.get<Cabinet>(`/medication${query({ q: q || undefined, filter: filter === 'all' ? undefined : filter })}`),
  summary: () => api.get<Summary>('/medication/summary'),
  today: (date?: string) => api.get<DayView>(`/medication/today${query({ date })}`),
  history: (from?: string, to?: string) =>
    api.get<Intake>(`/medication/history${query({ from, to })}`),
  doctorExport: () => api.get<DoctorExport>('/medication/export'),
  medicine: (id: string) => api.get<MedicineDetail>(`/medication/medicines/${id}`),
  addMedicine: (fields: MedicineFields & { name: string }) =>
    api.post<{ medicine: Medicine }>('/medication/medicines', fields),
  updateMedicine: (id: string, fields: MedicineFields) =>
    api.patch<{ medicine: Medicine }>(`/medication/medicines/${id}`, fields),
  removeMedicine: (id: string) => api.delete<void>(`/medication/medicines/${id}`),
  addPackage: (medicineId: string, fields: PackageFields & { quantity: number }) =>
    api.post<{ package: Package }>(`/medication/medicines/${medicineId}/packages`, fields),
  updatePackage: (id: string, fields: PackageFields) =>
    api.patch<{ package: Package }>(`/medication/packages/${id}`, fields),
  discardPackage: (id: string) => api.post<{ package: Package }>(`/medication/packages/${id}/discard`),
  removePackage: (id: string) => api.delete<void>(`/medication/packages/${id}`),
  addPhoto: (medicineId: string, image: string, kind: PhotoKind) =>
    api.post<{ photo: Photo }>(`/medication/medicines/${medicineId}/photos`, { image, kind }),
  updatePhoto: (id: string, patch: { kind?: PhotoKind; cover?: true }) =>
    api.patch<{ photo: Photo }>(`/medication/photos/${id}`, patch),
  removePhoto: (id: string) => api.delete<void>(`/medication/photos/${id}`),
  treatments: () => api.get<{ treatments: Treatment[] }>('/medication/treatments'),
  addTreatment: (fields: TreatmentFields) =>
    api.post<{ treatment: Treatment }>('/medication/treatments', fields),
  updateTreatment: (id: string, fields: Partial<Omit<TreatmentFields, 'medicineId' | 'personId' | 'kind' | 'startOn'>>) =>
    api.patch<{ treatment: Treatment }>(`/medication/treatments/${id}`, fields),
  stopTreatment: (id: string) => api.post<{ treatment: Treatment }>(`/medication/treatments/${id}/stop`),
  removeTreatment: (id: string) => api.delete<void>(`/medication/treatments/${id}`),
  takeAsNeeded: (id: string, override = false) =>
    api.post<{ dose: Dose }>(`/medication/treatments/${id}/take`, override ? { override: true } : {}),
  addToBuyList: (id: string) =>
    api.post<{ already: boolean }>(`/medication/treatments/${id}/buy`),
  take: (id: string) => api.post<{ dose: Dose }>(`/medication/doses/${id}/take`, {}),
  skip: (id: string, reason?: string) =>
    api.post<{ dose: Dose }>(`/medication/doses/${id}/skip`, reason ? { reason } : {}),
  snooze: (id: string, minutes: 10 | 30) =>
    api.post<{ dose: Dose }>(`/medication/doses/${id}/snooze`, { minutes }),
  undo: (id: string) => api.post<{ dose: Dose }>(`/medication/doses/${id}/undo`),
};
