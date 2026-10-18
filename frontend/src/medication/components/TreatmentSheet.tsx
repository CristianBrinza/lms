import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useUser } from '@/app/auth';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, CloseIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { Area, fieldClass } from '@/drinks/components/DrinkSheet';
import { ChipSet, Segmented } from '@/drinks/components/parts';
import {
  INSTRUCTIONS,
  medicationApi,
  medicationKeys,
  type EndKind,
  type Instruction,
  type Medicine,
  type Person,
  type ScheduleKind,
  type Treatment,
} from '../api';
import { useMedicationT } from '../i18n';
import { isoDate, presetTimes, weekdayShort } from '../logic';
import { PersonChips } from './parts';

const number = (text: string) => {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(n) ? n : null;
};

/** Starts a treatment (a medicine for a person, on a schedule or as needed), or edits one. */
export function TreatmentSheet({
  open,
  onClose,
  treatment,
  medicine,
  medicines,
  people,
}: {
  open: boolean;
  onClose: () => void;
  treatment?: Treatment | null;
  /** The medicine to start it for (from its page); otherwise the form asks. */
  medicine?: Medicine | null;
  medicines: Medicine[];
  people: Person[];
}) {
  const t = useMedicationT();
  return (
    <Sheet open={open} onClose={onClose} title={treatment ? t.editTreatment : t.newTreatment} size="lg">
      {open ? (
        <FormBody
          key={treatment?.id ?? medicine?.id ?? 'new'}
          treatment={treatment ?? null}
          medicine={medicine ?? null}
          medicines={medicines}
          people={people}
          onDone={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function FormBody({
  treatment,
  medicine,
  medicines,
  people,
  onDone,
}: {
  treatment: Treatment | null;
  medicine: Medicine | null;
  medicines: Medicine[];
  people: Person[];
  onDone: () => void;
}) {
  const t = useMedicationT();
  const user = useUser();
  const client = useQueryClient();
  const [medicineId, setMedicineId] = useState(treatment?.medicineId ?? medicine?.id ?? (medicines.length === 1 ? medicines[0]!.id : ''));
  const [personId, setPersonId] = useState(treatment?.personId ?? people.find((p) => p.id === user.id)?.id ?? people[0]?.id ?? '');
  const [dose, setDose] = useState(treatment ? String(treatment.dose) : '1');
  const [kind, setKind] = useState<ScheduleKind>(treatment?.kind ?? 'times');
  const [times, setTimes] = useState<string[]>(treatment?.times.length ? treatment.times : presetTimes(2));
  const [weekdays, setWeekdays] = useState<string[]>((treatment?.weekdays ?? []).map(String));
  const [intervalHours, setIntervalHours] = useState(treatment?.intervalHours ? String(treatment.intervalHours) : '8');
  const [maxPerDay, setMaxPerDay] = useState(treatment?.maxPerDay ? String(treatment.maxPerDay) : '');
  const [startOn, setStartOn] = useState(treatment?.startOn ?? isoDate(new Date()));
  const [endKind, setEndKind] = useState<EndKind>(treatment?.endKind ?? 'none');
  const [endOn, setEndOn] = useState(treatment?.endOn ?? '');
  const [endDays, setEndDays] = useState(treatment?.endDays ? String(treatment.endDays) : '7');
  const [endDoses, setEndDoses] = useState(treatment?.endDoses ? String(treatment.endDoses) : '10');
  const [instructions, setInstructions] = useState<string[]>(treatment?.instructions ?? []);
  const [lowDays, setLowDays] = useState(String(treatment?.lowDays ?? 5));
  const [notes, setNotes] = useState(treatment?.notes ?? '');

  const chosen = treatment
    ? ({ unit: treatment.unit, form: treatment.form } as Pick<Medicine, 'unit' | 'form'>)
    : medicines.find((m) => m.id === medicineId) ?? medicine;
  const unit = chosen ? t.unitName[chosen.unit] : '';
  const doseN = number(dose);
  const hours = number(intervalHours);
  const ready =
    Boolean(medicineId && personId) &&
    doseN !== null &&
    doseN > 0 &&
    (kind === 'prn' || (kind === 'times' ? times.length > 0 : hours !== null && hours >= 1 && hours <= 72)) &&
    (endKind !== 'date' || Boolean(endOn)) &&
    (endKind !== 'days' || (number(endDays) ?? 0) >= 1) &&
    (endKind !== 'doses' || (number(endDoses) ?? 0) >= 1);

  const save = useMutation({
    mutationFn: async () => {
      const common = {
        dose: doseN!,
        ...(kind === 'times' ? { times: [...new Set(times)].sort(), weekdays: weekdays.map(Number) } : {}),
        ...(kind === 'interval' ? { times: [times[0] ?? '08:00'], intervalHours: Math.round(hours!) } : {}),
        ...(kind === 'prn' ? { maxPerDay: maxPerDay.trim() ? Math.round(number(maxPerDay) ?? 0) || null : null } : {}),
        endKind: kind === 'prn' && endKind === 'doses' ? ('none' as const) : endKind,
        endOn: endKind === 'date' ? endOn : null,
        endDays: endKind === 'days' ? Math.round(number(endDays)!) : null,
        endDoses: endKind === 'doses' ? Math.round(number(endDoses)!) : null,
        instructions: instructions as Instruction[],
        notes: notes.trim(),
        lowDays: Math.max(1, Math.round(number(lowDays) ?? 5)),
      };
      if (treatment) return (await medicationApi.updateTreatment(treatment.id, common)).treatment;
      return (await medicationApi.addTreatment({ medicineId, personId, kind, startOn, ...common })).treatment;
    },
    onSuccess: () => {
      haptic('success');
      toast.success(t.saved);
      onDone();
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });

  const setTime = (index: number, value: string) =>
    setTimes((list) => list.map((time, i) => (i === index ? value : time)));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !save.isPending) save.mutate();
      }}
    >
      {!treatment && !medicine ? (
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">{t.medicineLabel}</span>
          <select
            value={medicineId}
            onChange={(e) => setMedicineId(e.target.value)}
            className={cx(fieldClass, 'h-14 appearance-none py-0')}
          >
            <option value="">{t.pickMedicine}</option>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {[m.name, m.strength].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-[1.0625rem] font-bold">
          {[treatment?.medicineName ?? medicine?.name, treatment?.strength ?? medicine?.strength].filter(Boolean).join(' ')}
        </p>
      )}

      {!treatment && people.length > 1 ? (
        <div>
          <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.forPerson}</p>
          <PersonChips people={people} value={personId} onChange={setPersonId} />
        </div>
      ) : null}

      <TextField
        label={t.doseLabel(unit)}
        inputMode="decimal"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
      />

      {!treatment ? (
        <Segmented
          label={t.scheduleKind.times}
          value={kind}
          onChange={setKind}
          options={(['times', 'interval', 'prn'] as const).map((k) => ({ value: k, label: t.scheduleKind[k] }))}
        />
      ) : null}

      {kind === 'times' ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.timesLabel}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTimes(presetTimes(n))}
                className={cx(
                  'press h-8 rounded-pill px-3 text-[0.8125rem] font-semibold transition-colors',
                  times.length === n ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                )}
              >
                {t.timesPerDay(n)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {times.map((time, index) => (
              <span key={index} className="flex items-center gap-1">
                <input
                  type="time"
                  aria-label={`${t.timesLabel} ${index + 1}`}
                  value={time}
                  onChange={(e) => setTime(index, e.target.value)}
                  className={cx(fieldClass, 'h-12 min-w-0 flex-1 py-0')}
                />
                {times.length > 1 ? (
                  <button
                    type="button"
                    aria-label={t.removeTime}
                    onClick={() => setTimes((list) => list.filter((_, i) => i !== index))}
                    className="press grid size-9 shrink-0 place-items-center rounded-full text-lg text-ink-600 hover:bg-ink-100"
                  >
                    <CloseIcon fontSize="inherit" />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
          {times.length < 12 ? (
            <Button
              type="button"
              size="sm"
              variant="tint"
              icon={AddIcon}
              className="self-start"
              onClick={() => setTimes((list) => [...list, '12:00'])}
            >
              {t.addTime}
            </Button>
          ) : null}
          <div>
            <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.weekdaysLabel}</p>
            <ChipSet
              label={t.weekdaysLabel}
              options={['1', '2', '3', '4', '5', '6', '7']}
              values={weekdays}
              onChange={setWeekdays}
              word={(id) => weekdayShort(Number(id))}
            />
            {!weekdays.length ? <p className="mt-1.5 px-1 text-xs text-ink-500">{t.everyDay}</p> : null}
          </div>
        </div>
      ) : null}

      {kind === 'interval' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label={t.intervalLabel}
            inputMode="numeric"
            value={intervalHours}
            onChange={(e) => setIntervalHours(e.target.value.replace(/\D/g, ''))}
          />
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.firstTime}</span>
            <input
              type="time"
              value={times[0] ?? '08:00'}
              onChange={(e) => setTimes([e.target.value])}
              className={cx(fieldClass, 'h-14 py-0')}
            />
          </label>
        </div>
      ) : null}

      {kind === 'prn' ? (
        <TextField
          label={t.maxPerDay}
          inputMode="numeric"
          value={maxPerDay}
          onChange={(e) => setMaxPerDay(e.target.value.replace(/\D/g, ''))}
        />
      ) : null}

      {!treatment ? (
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">{t.startOn}</span>
          <input
            type="date"
            value={startOn}
            onChange={(e) => setStartOn(e.target.value)}
            className={cx(fieldClass, 'h-14 py-0')}
          />
        </label>
      ) : null}

      <div className="flex flex-col gap-3">
        <p className="text-[0.8125rem] font-semibold text-ink-700">{t.endLabel}</p>
        <Segmented
          label={t.endLabel}
          value={endKind}
          onChange={setEndKind}
          options={(kind === 'prn' ? (['none', 'date', 'days'] as const) : (['none', 'date', 'days', 'doses'] as const)).map(
            (k) => ({ value: k, label: t.end[k] }),
          )}
        />
        {endKind === 'date' ? (
          <label className="flex min-w-0 flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.endDate}</span>
            <input
              type="date"
              value={endOn}
              min={startOn}
              onChange={(e) => setEndOn(e.target.value)}
              className={cx(fieldClass, 'h-14 py-0')}
            />
          </label>
        ) : null}
        {endKind === 'days' ? (
          <TextField label={t.endDays} inputMode="numeric" value={endDays} onChange={(e) => setEndDays(e.target.value.replace(/\D/g, ''))} />
        ) : null}
        {endKind === 'doses' ? (
          <TextField label={t.endDoses} inputMode="numeric" value={endDoses} onChange={(e) => setEndDoses(e.target.value.replace(/\D/g, ''))} />
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.instructionsLabel}</p>
        <ChipSet
          label={t.instructionsLabel}
          options={[...INSTRUCTIONS]}
          values={instructions}
          onChange={setInstructions}
          word={(id) => t.instruction[id as Instruction]}
          tone="mint"
        />
      </div>

      <TextField
        label={t.lowDays}
        inputMode="numeric"
        value={lowDays}
        onChange={(e) => setLowDays(e.target.value.replace(/\D/g, ''))}
      />
      <Area label={t.notes} value={notes} onChange={setNotes} rows={2} max={2000} />

      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!ready}>
        {t.save}
      </Button>
    </form>
  );
}
