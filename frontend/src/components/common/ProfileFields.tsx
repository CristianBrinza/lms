import { useRef, useState } from 'react';
import { Avatar, Button, TextField, toast } from '@/components/ui';
import { DeleteIcon, EditIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { shrinkPhoto } from '@/lib/photo';
import type { Goal, ProfileValues } from '@/lib/profile';
import type { Activity, Gender } from '@/types/api';

const GENDER_LABEL: Record<Gender, string> = { female: 'Female', male: 'Male', other: 'Other' };
const GOALS: Array<[Goal, string]> = [
  ['lose', 'Lose weight'],
  ['keep', 'Keep my weight'],
  ['gain', 'Gain weight'],
];
const RATES = [0.25, 0.5, 0.75];
const ACTIVITY: Array<[Activity, string]> = [
  ['sedentary', 'Mostly sitting'],
  ['light', 'On my feet a bit'],
  ['moderate', 'On my feet a lot'],
  ['active', 'Physical work'],
  ['very', 'Hard physical work'],
];

/** Gender, birth date, height, the goal and a usual day: for training plans and the energy numbers. */
export function ProfileFieldsForm({
  value,
  onChange,
}: {
  value: ProfileValues;
  onChange: (value: ProfileValues) => void;
}) {
  const chip = (active: boolean) =>
    cx(
      'press h-11 rounded-full px-4 text-[0.9375rem] font-semibold transition-colors',
      active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-800 hover:bg-ink-100',
    );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Gender</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={value.gender === g}
              className={chip(value.gender === g)}
              onClick={() => onChange({ ...value, gender: value.gender === g ? null : g })}
            >
              {GENDER_LABEL[g]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Birth date"
          type="date"
          max={today}
          min="1900-01-01"
          value={value.birthDate}
          onChange={(e) => onChange({ ...value, birthDate: e.target.value })}
        />
        <TextField
          label="Height, cm"
          inputMode="numeric"
          placeholder="170"
          value={value.height}
          onChange={(e) => onChange({ ...value, height: e.target.value.replace(/[^\d.,]/g, '') })}
        />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Goal</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {GOALS.map(([g, label]) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={value.goal === g}
              className={chip(value.goal === g)}
              onClick={() =>
                onChange({
                  ...value,
                  goal: value.goal === g ? null : g,
                  goalRate: value.goalRate ?? (g === 'gain' ? 0.25 : 0.5),
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      {value.goal && value.goal !== 'keep' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Goal weight, kg"
            inputMode="decimal"
            placeholder="70"
            value={value.goalWeight}
            onChange={(e) =>
              onChange({ ...value, goalWeight: e.target.value.replace(/[^\d.,]/g, '') })
            }
          />
          <fieldset>
            <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Pace</legend>
            <div role="radiogroup" className="flex flex-wrap gap-1.5">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={value.goalRate === r}
                  className={chip(value.goalRate === r)}
                  onClick={() => onChange({ ...value, goalRate: r })}
                >
                  {r} kg a week
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
      <fieldset>
        <legend className="mb-1 text-[0.8125rem] font-semibold text-ink-700">
          A usual day, without training
        </legend>
        <p className="mb-1.5 text-xs text-ink-500">
          Used when the phone doesn’t send active energy.
        </p>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {ACTIVITY.map(([a, label]) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={(value.activity ?? 'light') === a}
              className={chip((value.activity ?? 'light') === a)}
              onClick={() => onChange({ ...value, activity: a })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/**
 * The picture with "Change photo" and "Remove": a photo from the library or the camera, made
 * small on the device, sent as it is picked.
 */
export function PhotoPicker({
  person,
  onSave,
  busy,
}: {
  person: { id?: string; name: string; surname: string; avatarUrl?: string | null };
  onSave: (image: string | null) => Promise<unknown>;
  busy?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setWorking(true);
    try {
      await onSave(await shrinkPhoto(file));
      toast.success('Photo saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t save the photo');
    } finally {
      setWorking(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar person={person} size="xl" className="size-24 text-2xl ring-4" />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          size="sm"
          variant="soft"
          icon={EditIcon}
          loading={working || busy}
          onClick={() => input.current?.click()}
        >
          {person.avatarUrl ? 'Change photo' : 'Add a photo'}
        </Button>
        {person.avatarUrl ? (
          <Button
            size="sm"
            variant="ghost"
            icon={DeleteIcon}
            disabled={working || busy}
            onClick={() =>
              void onSave(null).then(
                () => toast.success('Photo removed'),
                () => toast.error('Couldn’t remove the photo'),
              )
            }
          >
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
