import type { Package, PackageFields, PackageKind } from './api';
import { expiryText, parseExpiry } from './logic';

/** The fields of a package, as typed: kept as text until they are saved. */
export interface PackageDraft {
  kind: PackageKind;
  quantity: string;
  original: string;
  expires: string;
  batch: string;
  openedOn: string;
  useWithin: string;
  place: string;
}

export const emptyDraft = (place = ''): PackageDraft => ({
  kind: 'box',
  quantity: '',
  original: '',
  expires: '',
  batch: '',
  openedOn: '',
  useWithin: '',
  place,
});

export const draftOf = (p: Package): PackageDraft => ({
  kind: p.kind,
  quantity: String(p.quantity),
  original: String(p.original),
  expires: expiryText(p.expiresOn, p.monthOnly),
  batch: p.batch,
  openedOn: p.openedOn ?? '',
  useWithin: p.useWithinDays ? String(p.useWithinDays) : '',
  place: p.place,
});

const number = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(n) ? n : null;
};

/** The draft as the API takes it; `invalid` names what to fix. */
export function draftFields(d: PackageDraft): { fields: PackageFields & { quantity: number } | null; invalidExpiry: boolean } {
  const quantity = number(d.quantity);
  const expires = d.expires.trim() ? parseExpiry(d.expires) : null;
  const invalidExpiry = Boolean(d.expires.trim()) && !expires;
  if (quantity === null || quantity < 0 || invalidExpiry) return { fields: null, invalidExpiry };
  const original = number(d.original);
  const within = number(d.useWithin);
  return {
    invalidExpiry,
    fields: {
      kind: d.kind,
      quantity,
      ...(original !== null && original >= 0 ? { original } : {}),
      expiresOn: expires,
      batch: d.batch.trim(),
      openedOn: d.openedOn || null,
      useWithinDays: within && within > 0 ? Math.round(within) : null,
      place: d.place.trim(),
    },
  };
}

