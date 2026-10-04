import type { Gender } from '@/types/api';

/** The profile form's values, and the same as the API takes them. */
export interface ProfileValues {
  gender: Gender | null;
  birthDate: string;
  height: string;
}

export const profileValues = (p: {
  gender: Gender | null;
  birthDate: string | null;
  heightCm: number | null;
}): ProfileValues => ({
  gender: p.gender,
  birthDate: p.birthDate ?? '',
  height: p.heightCm ? String(p.heightCm) : '',
});

/** The values as the API takes them; null clears. */
export function profileInput(v: ProfileValues) {
  const cm = Number(v.height.replace(',', '.'));
  return {
    gender: v.gender,
    birthDate: v.birthDate || null,
    heightCm: v.height.trim() && Number.isFinite(cm) ? Math.round(cm) : null,
  };
}
