import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Badge, Button, ButtonLink, Sheet, Skeleton, Spinner, TextField, toast } from '@/components/ui';
import { AddIcon, DeleteIcon, InstallIcon } from '@/components/ui/icons';
import type { IconComponent } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodKeys, remindersApi } from '@/food/api';
import type { Reminder } from '@/food/types';
import { NotificationsActiveIcon, NotificationsIcon, NotificationsOffIcon, SendIcon } from './icons';
import { currentSubscription, pushSupport, PushError, subscribeDevice, unsubscribeDevice } from './push';
import { daysLabel, DAYS, KIND_LABEL, MINUTES_BEFORE, reminderWhen } from './reminderText';

type RemindersData = Awaited<ReturnType<typeof remindersApi.list>>;
const deviceKey = ['me', 'push', 'device'] as const;

/**
 * Reminders on the phone: shopping on the way home, tomorrow's to-go food, food about to expire,
 * a heads-up before each meal, and your own. Phones: this device's notifications first (nothing
 * arrives without them), then the reminders. Tablets and up: reminders left, this device beside.
 */
export default function RemindersPage() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: foodKeys.reminders, queryFn: remindersApi.list });
  const [editing, setEditing] = useState<{ open: boolean; reminder: Reminder | null }>({ open: false, reminder: null });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => remindersApi.update(id, { enabled }),
    onMutate: ({ id, enabled }) => {
      haptic('tap');
      queryClient.setQueryData<RemindersData>(foodKeys.reminders, (old) =>
        old ? { ...old, reminders: old.reminders.map((r) => (r.id === id ? { ...r, enabled } : r)) } : old,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: foodKeys.reminders }),
  });

  return (
    <Screen tone="white">
      <PageHeader compact back="/settings" title="Reminders" subtitle="On your phone, from the kitchen as it is" />

      <div className="gutter-x mt-3 md:grid md:grid-cols-[minmax(0,1fr)_19rem] md:items-start md:gap-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:px-8">
        <div className="md:sticky md:top-4 md:col-start-2 md:row-start-1">
          {data.data ? <DevicePanel push={data.data.push} /> : <Skeleton className="h-32 rounded-3xl" />}
        </div>

        <section aria-labelledby="reminders-title" className="mt-4 md:col-start-1 md:row-start-1 md:mt-0">
          <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
            <h2 id="reminders-title" className="text-[0.9375rem] font-bold">
              What to remind you of
            </h2>
            <button
              type="button"
              onClick={() => setEditing({ open: true, reminder: null })}
              className="press -my-1 flex h-11 shrink-0 items-center gap-1 rounded-pill bg-lav-100 px-3.5 text-sm font-semibold text-ink-900 hover:bg-lav-200"
            >
              <AddIcon fontSize="inherit" className="text-[1.15rem]" />
              Add your own
            </button>
          </div>
          {data.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
            </div>
          ) : data.error ? (
            <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
              <p className="font-semibold text-danger-700">Couldn’t load your reminders</p>
              <p className="mt-1 text-sm text-ink-600">{errorMessage(data.error)}</p>
              <Button size="sm" variant="tint" className="mt-3" onClick={() => void data.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
              {data.data.reminders.map((reminder) => (
                <ReminderRow
                  key={reminder.id}
                  reminder={reminder}
                  onOpen={() => setEditing({ open: true, reminder })}
                  onToggle={(enabled) => toggle.mutate({ id: reminder.id, enabled })}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <ReminderSheet open={editing.open} reminder={editing.reminder} onClose={() => setEditing((e) => ({ ...e, open: false }))} />
    </Screen>
  );
}

// ---------------------------------------------------------------- the list

function ReminderRow({ reminder, onOpen, onToggle }: { reminder: Reminder; onOpen: () => void; onToggle: (enabled: boolean) => void }) {
  const custom = reminder.kind === 'custom';
  const title = custom ? reminder.text || 'Your reminder' : KIND_LABEL[reminder.kind];
  const when = reminderWhen(reminder);
  return (
    <li className="flex items-center">
      <button type="button" onClick={onOpen} className="press flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5 pr-2 text-left transition-colors hover:bg-ink-50">
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate text-[0.9375rem] font-semibold', !reminder.enabled && 'text-ink-500')}>{title}</span>
          <span className="tabular mt-0.5 block truncate text-sm text-ink-600">
            {custom ? 'Your own · ' : ''}
            {when}
          </span>
        </span>
      </button>
      <span className="pr-3.5">
        <Toggle checked={reminder.enabled} onChange={onToggle} label={title} />
      </span>
    </li>
  );
}

/** The Switch's look without its label (the row is the label). */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'group/switch relative inline-flex h-11 w-12 shrink-0 items-center rounded-pill before:absolute before:inset-x-0 before:top-2 before:h-7 before:rounded-pill before:transition-colors before:duration-200',
        checked ? 'before:bg-ink-900' : 'before:bg-ink-200',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'absolute left-0.5 h-6 w-6 rounded-full shadow-[0_2px_6px_rgb(29_29_36/0.25)] transition-[translate,background-color,width] duration-250 ease-(--ease-lift) group-active/switch:w-7',
          checked ? 'translate-x-5 bg-butter-300 group-active/switch:translate-x-4' : 'translate-x-0 bg-white',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------- one reminder

function ReminderSheet({ open, reminder, onClose }: { open: boolean; reminder: Reminder | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const kind = reminder?.kind ?? 'custom';
  const [time, setTime] = useState('18:00');
  const [minutes, setMinutes] = useState(45);
  const [days, setDays] = useState<number[]>(DAYS.map((d) => d.value));
  const [text, setText] = useState('');

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setTime(reminder?.time ?? '18:00');
      setMinutes(reminder?.minutesBefore ?? 45);
      setDays(reminder?.days.length ? [...reminder.days] : DAYS.map((d) => d.value));
      setText(reminder?.text ?? '');
    }
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.reminders });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        days: [...days].sort((a, b) => a - b),
        ...(kind === 'meal' ? { minutesBefore: minutes } : { time }),
        ...(kind === 'custom' ? { text: text.trim() } : {}),
      };
      return reminder ? remindersApi.update(reminder.id, body) : remindersApi.create({ ...body, kind: 'custom', enabled: true });
    },
    onSuccess: () => {
      toast.success(reminder ? 'Reminder saved' : 'Reminder added');
      void refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => remindersApi.remove(reminder!.id),
    onSuccess: () => {
      toast.success('Reminder deleted');
      void refresh();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const ready = days.length > 0 && (kind !== 'custom' || Boolean(text.trim())) && (kind === 'meal' || /^\d{2}:\d{2}$/.test(time));
  const minuteOptions = (MINUTES_BEFORE.includes(minutes) ? MINUTES_BEFORE : [...MINUTES_BEFORE, minutes].sort((a, b) => a - b)).map((value) => ({
    value,
    label: value < 60 ? `${value} min` : value % 60 ? `${Math.floor(value / 60)} h ${value % 60}` : `${value / 60} h`,
  }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={reminder ? (kind === 'custom' ? 'Your reminder' : KIND_LABEL[kind]) : 'New reminder'}
      footer={
        <div className="flex flex-col gap-2">
          {save.isError && !Object.keys(fields).length ? <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p> : null}
          <Button fullWidth onClick={() => save.mutate()} loading={save.isPending} disabled={!ready}>
            {reminder ? 'Save' : 'Add reminder'}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) save.mutate();
        }}
      >
        {kind === 'custom' ? (
          <TextField label="Say" placeholder="On the way home? Check the list." value={text} onChange={(event) => setText(event.target.value)} error={fields.text} maxLength={200} autoFocus={!reminder} />
        ) : null}
        {kind === 'meal' ? (
          <div>
            <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Before each planned meal</p>
            <div role="radiogroup" aria-label="Minutes before" className="grid grid-cols-3 gap-1 sm:grid-cols-6">
              {minuteOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={minutes === option.value}
                  onClick={() => setMinutes(option.value)}
                  className={cx(
                    'press tabular h-11 whitespace-nowrap rounded-pill px-2 text-sm font-semibold',
                    minutes === option.value ? 'bg-butter-300 text-ink-900' : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <TextField label="At" type="time" value={time} onChange={(event) => setTime(event.target.value)} error={fields.time} className="max-w-[12rem]" />
        )}
        <fieldset>
          <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
            On <span className="font-medium text-ink-500">· {days.length ? daysLabel(days) : 'pick at least one day'}</span>
          </legend>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => {
              const on = days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={day.long}
                  onClick={() => setDays((current) => (on ? current.filter((d) => d !== day.value) : [...current, day.value]))}
                  className={cx(
                    'press h-11 rounded-pill text-sm font-semibold',
                    on ? 'bg-butter-300 text-ink-900' : 'bg-butter-100 text-ink-600 hover:bg-butter-200',
                  )}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
          {fields.days ? <p className="mt-1.5 text-sm font-medium text-danger-600">{fields.days}</p> : null}
        </fieldset>
        {reminder && kind === 'custom' ? (
          <Button variant="ghost" size="sm" icon={DeleteIcon} className="self-start text-danger-700 hover:bg-danger-50" loading={remove.isPending} onClick={() => remove.mutate()}>
            Delete reminder
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------- this device

function DevicePanel({ push }: { push: RemindersData['push'] }) {
  const queryClient = useQueryClient();
  const support = pushSupport();
  const device = useQuery({ queryKey: deviceKey, queryFn: async () => (await currentSubscription())?.endpoint ?? null, enabled: support === 'ok' });
  const on = Boolean(device.data);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: deviceKey });
    void queryClient.invalidateQueries({ queryKey: foodKeys.reminders });
  };

  const turnOn = useMutation({
    mutationFn: async () => {
      if (!push.publicKey) throw new PushError('Reminders aren’t set up on the server yet.');
      const subscription = await subscribeDevice(push.publicKey);
      return remindersApi.subscribe(subscription.toJSON());
    },
    onSuccess: () => {
      haptic('success');
      toast.success('Notifications are on', { description: 'Send a test to see one.' });
      refresh();
    },
    onError: (error) => toast.error(error instanceof PushError ? error.message : errorMessage(error)),
  });
  const turnOff = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeDevice();
      if (endpoint) await remindersApi.unsubscribe(endpoint);
    },
    onSuccess: () => {
      toast.success('Notifications are off on this device');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const test = useMutation({
    mutationFn: remindersApi.test,
    onSuccess: ({ sent }) => toast.success(sent === 1 ? 'Test sent' : `Test sent to ${sent} devices`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const devices = push.devices === 0 ? 'No device gets them yet' : push.devices === 1 ? 'They go to 1 device' : `They go to ${push.devices} devices`;
  let tone = 'bg-ink-100 text-ink-700';
  let Icon: IconComponent = NotificationsOffIcon;
  let headline = 'Off on this device';
  if (on) {
    tone = 'bg-mint-200 text-mint-800';
    Icon = NotificationsActiveIcon;
    headline = 'On on this device';
  } else if (support === 'ok' && push.available) {
    tone = 'bg-butter-300 text-ink-900';
    Icon = NotificationsIcon;
  }

  return (
    <section aria-labelledby="device-title" className="rounded-[1.5rem] bg-white p-3.5 shadow-[var(--shadow-raised)]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cx('grid size-11 shrink-0 place-items-center rounded-2xl text-[1.45rem]', tone)}>
          <Icon fontSize="inherit" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="device-title" className="text-[1rem] font-bold leading-tight">
            {headline}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] font-medium text-ink-600">{devices}</p>
        </div>
        {on ? <Badge tone="mint">On</Badge> : null}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {!push.available ? (
          <p className="rounded-2xl bg-ink-50 p-3 text-sm text-ink-700">Reminders aren’t set up on the server yet.</p>
        ) : support === 'install-first' ? (
          <ButtonLink to="/app" variant="primary" size="md" icon={InstallIcon} fullWidth>
            Add LMS to the Home Screen
          </ButtonLink>
        ) : support === 'unsupported' ? (
          <p className="rounded-2xl bg-ink-50 p-3 text-sm text-ink-700">This browser can’t show notifications.</p>
        ) : device.isLoading ? (
          <Skeleton className="h-12 rounded-pill" />
        ) : on ? (
          <>
            <Button variant="tint" size="md" icon={SendIcon} fullWidth loading={test.isPending} onClick={() => test.mutate()}>
              Send a test
            </Button>
            <Button variant="outline" size="md" icon={NotificationsOffIcon} fullWidth loading={turnOff.isPending} onClick={() => turnOff.mutate()}>
              Turn off on this device
            </Button>
          </>
        ) : (
          <>
            {/* The full sentence wraps on a narrow panel instead of being cut. */}
            <button
              type="button"
              onClick={() => turnOn.mutate()}
              disabled={turnOn.isPending}
              aria-busy={turnOn.isPending || undefined}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-ink-900 px-5 py-2.5 text-center text-[0.9375rem] font-semibold leading-snug text-white shadow-[0_1px_2px_rgb(29_29_36/0.3),0_12px_22px_-12px_rgb(29_29_36/0.85)] hover:bg-ink-800 disabled:opacity-60"
            >
              {turnOn.isPending ? <Spinner className="size-5 shrink-0" /> : <NotificationsActiveIcon fontSize="inherit" className="shrink-0 text-[1.3rem]" />}
              Turn on notifications on this device
            </button>
            {push.devices > 0 ? (
              <Button variant="tint" size="md" icon={SendIcon} fullWidth loading={test.isPending} onClick={() => test.mutate()}>
                Send a test
              </Button>
            ) : null}
          </>
        )}
        <p className="px-1 text-xs leading-snug text-ink-500">On iPhone and iPad, notifications work only from the Home Screen app (iOS 16.4 or later).</p>
      </div>
    </section>
  );
}
