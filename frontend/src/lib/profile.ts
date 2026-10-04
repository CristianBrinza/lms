import type { Activity, Gender } from '@/types/api';

export type Goal = 'lose' | 'keep' | 'gain';

/** The profile form's values, and the same as the API takes them. */
export interface ProfileValues {
  gender: Gender | null;
  birthDate: string;
  height: string;
  goal: Goal | null;
  goalWeight: string;
  goalRate: number | null;
  activity: Activity | null;
}

export const profileValues = (p: {
  gender: Gender | null;
  birthDate: string | null;
  heightCm: number | null;
  goal?: Goal | null;
  goalWeight?: number | null;
  goalRate?: number | null;
  activity?: Activity | null;
}): ProfileValues => ({
  gender: p.gender,
  birthDate: p.birthDate ?? '',
  height: p.heightCm ? String(p.heightCm) : '',
  goal: p.goal ?? null,
  goalWeight: p.goalWeight ? String(p.goalWeight) : '',
  goalRate: p.goalRate ?? null,
  activity: p.activity ?? null,
});

const num = (text: string) => {
  const n = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(n) ? n : null;
};

/** The values as the API takes them; null clears. */
export function profileInput(v: ProfileValues) {
  const cm = num(v.height);
  const kg = num(v.goalWeight);
  return {
    gender: v.gender,
    birthDate: v.birthDate || null,
    heightCm: cm === null ? null : Math.round(cm),
    goal: v.goal,
    goalWeight: kg === null ? null : Math.round(kg * 10) / 10,
    goalRate: v.goal === 'keep' ? null : v.goalRate,
    activity: v.activity,
  };
}
