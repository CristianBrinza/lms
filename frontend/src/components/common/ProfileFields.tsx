import { useRef, useState } from 'react';
import { Avatar, Button, TextField, toast } from '@/components/ui';
import { DeleteIcon, EditIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { shrinkPhoto } from '@/lib/photo';
import type { ProfileValues } from '@/lib/profile';
import type { Gender } from '@/types/api';

const GENDER_LABEL: Record<Gender, string> = { female: 'Female', male: 'Male', other: 'Other' };

/** Gender, birth date and height: for Training's plans and Health's numbers, and for who is who. */
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
