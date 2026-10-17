import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import {
  AddIcon,
  ArrowBackIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  ErrorIcon,
  RemoveIcon,
  SparkleIcon,
  SyncIcon,
  type IconComponent,
} from '@/components/ui/icons';
import FlagIcon from '@mui/icons-material/FlagRounded';
import ListIcon from '@mui/icons-material/FormatListBulletedRounded';
import PauseIcon from '@mui/icons-material/PauseRounded';
import PlayIcon from '@mui/icons-material/PlayArrowRounded';
import FeelGreatIcon from '@mui/icons-material/SentimentVerySatisfiedRounded';
import FeelGoodIcon from '@mui/icons-material/SentimentSatisfiedRounded';
import FeelOkIcon from '@mui/icons-material/SentimentNeutralRounded';
import FeelHardIcon from '@mui/icons-material/SentimentDissatisfiedRounded';
import FeelVeryHardIcon from '@mui/icons-material/SentimentVeryDissatisfiedRounded';
import NextIcon from '@mui/icons-material/SkipNextRounded';
import PreviousIcon from '@mui/icons-material/SkipPreviousRounded';
import SoundOffIcon from '@mui/icons-material/VolumeOffRounded';
import SoundOnIcon from '@mui/icons-material/VolumeUpRounded';
import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { session } from '@/lib/storage';
import { useThemeColor } from '@/lib/themeColor';
import { isApiError } from '@/services/api/client';
import { trainingApi, trainingKeys } from '../api';
import {
  BLOCK_LABEL,
  RECORD_LABEL,
  clock,
  distance,
  duration,
  kg,
  setLabel,
  target,
} from '../format';
import { trainingT, useTrainingT } from '../i18n';
import { ExerciseIcon } from '../icons/TrainingIcon';
import type { LibraryExercise, RecordKind, SetInput, TrainingSet, Workout } from '../types';
import { WayChips } from '../components/WayChips';
import {
  countdown,
  endsAt,
  fraction,
  idleWatch,
  isRunning,
  pause,
  secondsLeft,
  secondsRun,
  start,
  stopwatch,
  add as addTime,
  type Timer,
  type Watch,
} from './clock';
import { beep, hush, newBest, say, stepStart, timerEnd, unlock, useSound } from './feedback';
import {
  buildSteps,
  doneKeys,
  firstUndone,
  isWork,
  nextWork,
  previousWork,
  progress,
  speechFor,
  stepKey,
  workAt,
  type Step,
  type WorkStep,
} from './sequence';
import { LAST_TIME_PREFIXES, playerT, usePlayerT } from './PlayerPage.i18n';
import { useWakeLock } from './useWakeLock';

/**
 * The workout player: the phone propped against the wall, one step at a time in big type. Reps
 * are counted with − / + and logged with Done; holds run a ring that logs itself at 0; rests count
 * down with 3-2-1 beeps and move on by themselves. Every timer is a timestamp, so a locked phone
 * comes back to the right second. Sets are saved as they're done (kept and retried when offline),
 * the place is kept across a reload, and a second device picks up after the last logged set.
 * Tablets and desktop get the step list beside the current step.
 */

// ---------------------------------------------------------------- the run

type Phase = 'start' | 'ready' | 'play' | 'end';

interface Run {
  phase: Phase;
  /** The current step; steps.length at the end. */
  index: number;
  /** Everything stopped by the person (Pause). */
  paused: boolean;
  /** Time trained, pauses left out. */
  active: Watch;
  /** The current step's (or "Get ready"'s) timer. */
  timer: Timer;
  /** Whether that timer should be running whenever the player isn't paused. */
  timerOn: boolean;
}

interface Saved extends Run {
  v: 1;
  savedAt: number;
}

interface Pending {
  key: string;
  body: SetInput;
  /** A try failed: it may have reached the server anyway, so check before sending it again. */
  tried: boolean;
}

interface Best {
  exercise: string;
  icon: string;
  kinds: RecordKind[];
}

interface Values {
  reps: number;
  weight: number | null;
  /** Grip, stance or band: picked once, it stays for that exercise's next sets. */
  variant: string | null;
  /** Kilometres as typed. */
  km: string;
}

/**
 * Out of the player, back where it was opened from (the workout, the plan, Training's home): a
 * step back in history, so Back from there never lands in the player again. Opened from a link
 * with nothing behind it, the workout replaces the player instead.
 */
function leavePlayer(navigate: ReturnType<typeof useNavigate>, id: string) {
  if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1);
  else navigate(`/training/workouts/${id}`, { replace: true });
}

const READY_SECONDS = 5;
const runKey = (id: string) => `lms:training-player:${id}`;
const pendingKey = (id: string) => `lms:training-pending:${id}`;
const bestsKey = (id: string) => `lms:training-bests:${id}`;

function readJson<T>(key: string): T | null {
  const raw = session.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const measureOf = (step: WorkStep) => step.item.exercise.measure;
const targetSeconds = (step: WorkStep) => step.item.seconds ?? step.item.exercise.seconds ?? 30;
const targetMetres = (step: WorkStep) => step.item.distance ?? step.item.exercise.distance ?? 1000;
const targetReps = (step: WorkStep) => step.item.reps ?? step.item.exercise.reps ?? 10;

function defaults(step: WorkStep): Values {
  const { item } = step;
  return {
    reps: item.suggest?.reps ?? targetReps(step),
    weight: item.exercise.weighted ? (item.suggest?.weight ?? item.weight ?? null) : null,
    variant: item.variant ?? null,
    km: String(Math.round((item.suggest?.distance ?? targetMetres(step)) / 10) / 100),
  };
}

/**
 * Puts the player on a step at time `at`. `auto`: it was reached by a timer or a Done, so a hold
 * starts by itself (the 3-2-1 before it was the warning); reached by hand, it waits for a tap.
 */
function enter(
  run: Run,
  steps: Step[],
  index: number,
  at: number,
  auto: boolean,
  done?: Set<string>,
): Run {
  if (index >= steps.length) {
    return {
      ...run,
      phase: 'end',
      index: steps.length,
      active: pause(run.active, at),
      timer: stopwatch(),
      timerOn: false,
    };
  }
  const to = Math.max(0, index);
  const step = steps[to]!;
  let timer = stopwatch();
  let timerOn = false;
  if (step.kind === 'rest') {
    timer = countdown(step.seconds);
    timerOn = true;
  } else if (measureOf(step) === 'time') {
    timer = countdown(targetSeconds(step));
    // A hold already logged waits: it shows its result, not a clock running out of sight.
    timerOn = auto && !done?.has(stepKey(step));
  }
  return {
    ...run,
    phase: 'play',
    index: to,
    active: run.paused ? run.active : start(run.active, at),
    timer: timerOn && !run.paused ? start(timer, at) : timer,
    timerOn,
  };
}

const pauseRun = (run: Run, now: number): Run => ({
  ...run,
  paused: true,
  active: pause(run.active, now),
  timer: pause(run.timer, now),
});

const resumeRun = (run: Run, now: number): Run => ({
  ...run,
  paused: false,
  active: run.phase === 'end' ? run.active : start(run.active, now),
  timer: run.timerOn ? start(run.timer, now) : run.timer,
});

type Ended =
  { kind: 'ready' } | { kind: 'rest' } | { kind: 'hold'; step: WorkStep; seconds: number };

/**
 * Runs every timer that has run out by `now`, in order, each next step starting when the last one
 * ended: a phone locked through a rest and a plank comes back with both done and the plank logged.
 */
function settle(
  run: Run,
  steps: Step[],
  now: number,
  done?: Set<string>,
): { run: Run; ended: Ended[] } {
  const ended: Ended[] = [];
  let current = run;
  for (let guard = 0; guard < 400; guard++) {
    if (current.paused || !current.timerOn) break;
    if (current.phase !== 'ready' && current.phase !== 'play') break;
    const end = endsAt(current.timer);
    if (end === null || end > now) break;
    if (current.phase === 'ready') {
      ended.push({ kind: 'ready' });
      current = enter(current, steps, current.index, end, true, done);
      continue;
    }
    const step = steps[current.index];
    if (!step) break;
    if (step.kind === 'rest') {
      ended.push({ kind: 'rest' });
      current = enter(current, steps, step.next, end, true, done);
      continue;
    }
    if (measureOf(step) !== 'time') break;
    ended.push({ kind: 'hold', step, seconds: Math.round((current.timer.total ?? 0) / 1000) });
    current = enter(current, steps, current.index + 1, end, true, done);
  }
  return { run: current, ended };
}

/** Where the player opens: this tab's saved place, or after the last set logged anywhere. */
function initialRun(workout: Workout, steps: Step[], pending: Pending[]): Run {
  const now = Date.now();
  const sets = workout.sets;
  // Sets still waiting to be saved count as done here.
  const waiting = pending.map(
    (p) =>
      ({
        itemIndex: p.body.itemIndex ?? null,
        round: p.body.round ?? null,
        setNumber: p.body.setNumber ?? null,
        side: p.body.side ?? null,
      }) as TrainingSet,
  );
  const resumeAt = firstUndone(steps, sets.concat(waiting));
  const saved = readJson<Saved>(runKey(workout.id));
  if (
    saved?.v === 1 &&
    saved.phase !== 'start' &&
    typeof saved.index === 'number' &&
    saved.index <= steps.length
  ) {
    const at = Math.min(now, saved.savedAt || now);
    const run: Run = {
      phase: saved.phase === 'ready' ? 'play' : saved.phase,
      index: saved.index,
      paused: saved.phase !== 'end',
      active: pause(saved.active ?? idleWatch, at),
      timer: pause(saved.timer ?? stopwatch(), at),
      timerOn: Boolean(saved.timerOn),
    };
    if (run.index >= steps.length)
      return { ...run, phase: 'end', index: steps.length, paused: false };
    // Another device got further meanwhile.
    if (resumeAt > workAt(steps, run.index) && resumeAt < steps.length && run.phase !== 'end') {
      return enter({ ...run, paused: true }, steps, resumeAt, now, false);
    }
    // A saved timer that doesn't fit its step (the workout was edited since): start the step over.
    const fresh = enter({ ...run, paused: true }, steps, run.index, at, false);
    if (run.phase === 'play' && (fresh.timer.total === null) !== (run.timer.total === null))
      return { ...run, timer: fresh.timer, timerOn: fresh.timerOn };
    return run;
  }
  // Nothing saved here: open after the last set logged (on this or another device).
  let banked = 0;
  if (sets.length && workout.startedAt) {
    const started = Date.parse(workout.startedAt);
    const last = Math.max(...sets.map((s) => Date.parse(s.performedAt)).filter(Number.isFinite));
    if (Number.isFinite(started) && Number.isFinite(last))
      banked = Math.min(3 * 3600_000, Math.max(0, last - started));
  }
  const base: Run = {
    phase: 'start',
    index: 0,
    paused: false,
    active: { since: null, banked },
    timer: countdown(READY_SECONDS),
    timerOn: false,
  };
  if (!sets.length) return base;
  if (resumeAt >= steps.length) return { ...base, phase: 'end', index: steps.length };
  return { ...base, index: resumeAt };
}

/** Lost connection, a server hiccup, a session being refreshed: worth trying again. */
function retryable(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return (
    error.code === 'NETWORK' ||
    error.code === 'UPSTREAM_UNAVAILABLE' ||
    error.status === 0 ||
    error.status === 401 ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
  );
}

function setFor(sets: TrainingSet[], key: string): TrainingSet | undefined {
  return sets.find(
    (s) =>
      s.itemIndex !== null &&
      s.setNumber !== null &&
      stepKey({
        itemIndex: s.itemIndex,
        round: s.round ?? 1,
        setNumber: s.setNumber,
        side: s.side,
      }) === key,
  );
}

/** An exercise's name in the current language. */
const nameOf = (exercise: LibraryExercise) => tr(exercise, 'name');

/** "Set 2 of 3 · Round 1 of 3 · Left side". */
function stepMeta(step: WorkStep): string {
  const t = playerT();
  return [
    step.block !== 'main' ? BLOCK_LABEL[step.block] : null,
    step.item.sets > 1 ? t.meta.set(step.setNumber, step.item.sets) : null,
    step.rounds > 1 ? t.meta.round(step.round, step.rounds) : null,
    step.side ? t.meta.side(step.side) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Last time 10, 12 · 8 kg". */
function lastTime(step: WorkStep): string | null {
  const last = step.item.last;
  if (!last?.sets.length) return null;
  let sets = last.sets;
  if (step.side && sets.some((s) => s.side)) sets = sets.filter((s) => s.side === step.side);
  if (!sets.length) return null;
  const measure = measureOf(step);
  let text: string;
  if (measure === 'reps') {
    const weights = [...new Set(sets.map((s) => s.weight ?? 0))];
    text =
      weights.length === 1
        ? `${sets.map((s) => s.reps ?? 0).join(', ')}${weights[0] ? ` · ${kg(weights[0])}` : ''}`
        : sets.map((s) => `${s.reps ?? 0}${s.weight ? ` × ${kg(s.weight)}` : ''}`).join(', ');
  } else if (measure === 'time') text = sets.map((s) => duration(s.seconds ?? 0)).join(', ');
  else text = sets.map((s) => setLabel(s)).join(', ');
  return playerT().lastTime(text);
}

/** The ink of the player, read from the tokens (the bars match the dark screen). */
function inkColor(): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue('--color-ink-900').trim();
}

// ---------------------------------------------------------------- the page

export default function PlayerPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [ink] = useState(inkColor);
  useThemeColor(ink || 'black');
  const workout = useQuery({
    queryKey: trainingKeys.workout(id),
    queryFn: () => trainingApi.workout(id),
  });
  const close = () => leavePlayer(navigate, id);
  const t = usePlayerT();

  if (workout.isPending) return <Loading />;
  if (workout.error || !workout.data) {
    return (
      <Message
        title={t.open.failed}
        text={errorMessage(workout.error)}
        onClose={close}
        action={
          <DarkButton tone="butter" onClick={() => void workout.refetch()}>
            {t.open.tryAgain}
          </DarkButton>
        }
      />
    );
  }
  const data = workout.data;
  if (data.status === 'done') return <Summary workout={data} />;
  if (data.status === 'skipped') {
    return <Message title={t.open.skipped} text={t.open.skippedText} onClose={close} />;
  }
  if (!data.items.length) {
    return <Message title={t.open.empty} text={t.open.emptyText} onClose={close} />;
  }
  return <Player key={data.id} workout={data} />;
}

function Player({ workout }: { workout: Workout }) {
  const id = workout.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const steps = useMemo(() => buildSteps(workout), [workout]);

  // ---- sets waiting to be saved
  const [pending, setPendingState] = useState<Pending[]>(
    () => readJson<Pending[]>(pendingKey(id)) ?? [],
  );
  const queue = useRef(pending);
  const setPending = useCallback(
    (next: Pending[]) => {
      queue.current = next;
      setPendingState(next);
      if (next.length) session.set(pendingKey(id), JSON.stringify(next));
      else session.remove(pendingKey(id));
    },
    [id],
  );

  // ---- where the player is
  const [run, setRun] = useState<Run>(() => initialRun(workout, steps, pending));
  const runRef = useRef(run);
  const [now, setNow] = useState(() => Date.now());
  const lastLeft = useRef<number | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Values>>>({});
  const [ways, setWays] = useState<Record<number, string | null>>({});
  const [listOpen, setListOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [finishing, setFinishing] = useState<{ seconds: number } | null>(null);
  const [best, setBest] = useState<{ text: string; n: number } | null>(null);
  const bestTimer = useRef<number | undefined>(undefined);
  const [sound, setSound] = useSound();
  const t = usePlayerT();

  const done = useMemo(() => {
    const keys = doneKeys(workout.sets);
    pending.forEach((p) => keys.add(p.key));
    return keys;
  }, [workout.sets, pending]);
  const hasSets = workout.sets.length > 0 || pending.length > 0;
  const step = run.phase === 'play' ? steps[run.index] : undefined;
  const at = progress(steps, run.index, done);

  const valuesFor = useCallback(
    (s: WorkStep): Values => {
      const base = { ...defaults(s), ...edits[stepKey(s)] };
      return s.itemIndex in ways ? { ...base, variant: ways[s.itemIndex] ?? null } : base;
    },
    [edits, ways],
  );
  const edit = (s: WorkStep, patch: Partial<Values>) => {
    if ('variant' in patch)
      setWays((current) => ({ ...current, [s.itemIndex]: patch.variant ?? null }));
    setEdits((current) => ({
      ...current,
      [stepKey(s)]: { ...current[stepKey(s)], ...patch },
    }));
  };

  // ---- saving sets: one at a time, in order, never twice
  const inflight = useRef<Promise<void> | null>(null);
  const onLogged = useCallback(
    (result: { set: TrainingSet; records: RecordKind[] }) => {
      queryClient.setQueryData<Workout>(trainingKeys.workout(id), (old) =>
        old && !old.sets.some((s) => s.id === result.set.id)
          ? {
              ...old,
              sets: [...old.sets, result.set],
              setsDone: old.setsDone + 1,
              status: old.status === 'planned' ? 'active' : old.status,
            }
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['training', 'overview'] });
      void queryClient.invalidateQueries({ queryKey: trainingKeys.workout(id) });
      if (result.records.length) {
        const kinds = [...new Set(result.records)];
        const bests = readJson<Best[]>(bestsKey(id)) ?? [];
        bests.push({ exercise: tr(result.set, 'exercise'), icon: result.set.icon, kinds });
        session.set(bestsKey(id), JSON.stringify(bests));
        newBest();
        window.clearTimeout(bestTimer.current);
        setBest((current) => ({
          text: trainingT().newBest(kinds.map((k) => RECORD_LABEL[k]).join(' · ')),
          n: (current?.n ?? 0) + 1,
        }));
        bestTimer.current = window.setTimeout(() => setBest(null), 3200);
      }
    },
    [id, queryClient],
  );

  const flush = useCallback((): Promise<void> => {
    if (inflight.current) return inflight.current;
    if (!queue.current.length) return Promise.resolve();
    const work = (async () => {
      if (queue.current.some((p) => p.tried)) {
        // A try that failed may have been saved anyway (the answer got lost): look first.
        try {
          const fresh = await trainingApi.workout(id);
          queryClient.setQueryData(trainingKeys.workout(id), fresh);
          const saved = doneKeys(fresh.sets);
          setPending(queue.current.filter((p) => !(p.tried && saved.has(p.key))));
        } catch {
          return;
        }
      }
      while (queue.current.length) {
        const item = queue.current[0]!;
        try {
          const result = await trainingApi.logWorkoutSet(id, item.body);
          setPending(queue.current.filter((p) => p.key !== item.key));
          onLogged(result);
        } catch (error) {
          if (retryable(error)) {
            setPending(queue.current.map((p) => (p.key === item.key ? { ...p, tried: true } : p)));
            return;
          }
          // Refused for good (the workout was skipped meanwhile, a bad value): say so, move on.
          setPending(queue.current.filter((p) => p.key !== item.key));
          toast.error(errorMessage(error, playerT().saveFailed));
        }
      }
    })().finally(() => {
      inflight.current = null;
    });
    inflight.current = work;
    return work;
  }, [id, onLogged, queryClient, setPending]);

  const logSet = (
    s: WorkStep,
    values: Pick<SetInput, 'reps' | 'weight' | 'seconds' | 'distance'>,
  ) => {
    const key = stepKey(s);
    if (doneNow().has(key)) return;
    const way = valuesFor(s).variant;
    const body: SetInput = {
      exerciseId: s.item.exerciseId,
      ...values,
      ...(way ? { variant: way } : {}),
      // The set's own id: a retry after a lost answer is recognised, never logged twice.
      clientId: crypto.randomUUID(),
      side: s.side,
      itemIndex: s.itemIndex,
      round: s.round,
      setNumber: s.setNumber,
    };
    setPending([...queue.current, { key, body, tried: false }]);
    void flush();
  };

  /** Logged or waiting to be: read at the moment (a set queued a moment ago counts). */
  const doneNow = () => {
    const saved = queryClient.getQueryData<Workout>(trainingKeys.workout(id))?.sets ?? workout.sets;
    const keys = doneKeys(saved);
    queue.current.forEach((p) => keys.add(p.key));
    return keys;
  };

  // Retry when the connection or the screen comes back, and anything left from before a reload.
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === 'visible') void flush();
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    const first = window.setTimeout(retry, 0);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [flush]);

  // ---- moving
  const commit = (next: Run) => {
    const prev = runRef.current;
    runRef.current = next;
    if (next.index !== prev.index || next.phase !== prev.phase) lastLeft.current = null;
    if (
      next.phase === 'end' &&
      prev.phase !== 'end' &&
      (workout.sets.length || queue.current.length)
    )
      setFinishing({ seconds: secondsRun(next.active) });
    setRun(next);
    setNow(Date.now());
  };

  const tick = useEffectEvent(() => {
    const t = Date.now();
    setNow(t);
    const current = runRef.current;
    if (!current.paused && current.timerOn && current.timer.total !== null) {
      const left = secondsLeft(current.timer, t);
      if (left !== lastLeft.current) {
        if (lastLeft.current !== null && left >= 1 && left <= 3) beep('tick');
        lastLeft.current = left;
      }
    }
    const { run: next, ended } = settle(current, steps, t, doneNow());
    if (!ended.length) return;
    for (const e of ended) {
      if (e.kind === 'hold') {
        const values = valuesFor(e.step);
        logSet(e.step, { seconds: e.seconds, weight: values.weight });
      }
    }
    timerEnd();
    commit(next);
  });

  const ticking = (run.phase === 'ready' || run.phase === 'play') && !run.paused;
  const fast = ticking && run.timerOn;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => tick(), fast ? 200 : 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ticking, fast]);

  // Keep the place across a reload (and when the tab is put away, the moment it was).
  useEffect(() => {
    if (run.phase === 'start') return;
    const save = () =>
      session.set(runKey(id), JSON.stringify({ ...runRef.current, v: 1, savedAt: Date.now() }));
    save();
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, [run, id]);

  // Say each step as it begins (and again on Resume).
  const announce = useEffectEvent(() => {
    const current = runRef.current;
    if (current.paused) return;
    if (current.phase === 'ready') {
      const first = steps[current.index];
      say(t.speech.getReady(isWork(first) ? nameOf(first.item.exercise) : null));
    } else if (current.phase === 'play') stepStart(speechFor(steps, current.index));
    else if (current.phase === 'end') say(t.speech.finished);
  });
  const announcedOnce = useRef(false);
  useEffect(() => {
    // Not on opening: the place is shown paused or waiting for Start, and iOS can't speak yet.
    if (!announcedOnce.current) {
      announcedOnce.current = true;
      return;
    }
    announce();
  }, [run.phase, run.index, run.paused]);

  useEffect(
    () => () => {
      hush();
      window.clearTimeout(bestTimer.current);
    },
    [],
  );

  useWakeLock((run.phase === 'ready' || run.phase === 'play') && !run.paused);

  const begin = () => {
    unlock();
    haptic('tap');
    if (workout.status === 'planned') {
      void trainingApi
        .startWorkout(id)
        .then((started) => queryClient.setQueryData(trainingKeys.workout(id), started))
        .catch(() => undefined); // The first set starts it too.
    }
    const t = Date.now();
    commit({
      ...runRef.current,
      phase: 'ready',
      paused: false,
      active: start(runRef.current.active, t),
      timer: start(countdown(READY_SECONDS), t),
      timerOn: true,
    });
  };
  const skipReady = () => {
    unlock();
    commit(enter(runRef.current, steps, runRef.current.index, Date.now(), true, doneNow()));
  };
  const togglePause = () => {
    unlock();
    haptic('tap');
    const current = runRef.current;
    commit(current.paused ? resumeRun(current, Date.now()) : pauseRun(current, Date.now()));
  };
  const goTo = (index: number) => {
    haptic('tap');
    commit(enter({ ...runRef.current }, steps, index, Date.now(), false));
  };
  const goNext = () => {
    const current = runRef.current;
    const s = steps[current.index];
    if (current.phase !== 'play' || !s) return;
    const to = s.kind === 'rest' ? s.next : nextWork(steps, current.index);
    goTo(to === -1 ? steps.length : to);
  };
  const goPrevious = () => {
    const current = runRef.current;
    const to = previousWork(steps, current.index);
    if (to >= 0) goTo(to);
  };
  /** After a set is done: on to its rest (or the next set), which starts by itself. */
  const afterWork = () =>
    commit(enter(runRef.current, steps, runRef.current.index + 1, Date.now(), true, doneNow()));
  const jump = (index: number) => {
    setListOpen(false);
    if (runRef.current.phase === 'start') commit({ ...runRef.current, index });
    else goTo(index);
  };
  const skipRest = () => {
    const s = steps[runRef.current.index];
    if (s?.kind === 'rest') {
      haptic('tap');
      commit(enter(runRef.current, steps, s.next, Date.now(), true, doneNow()));
    }
  };
  const changeRest = (seconds: number) => {
    haptic('tap');
    const current = runRef.current;
    commit({ ...current, timer: addTime(current.timer, seconds, Date.now()) });
  };
  const toggleTimer = () => {
    unlock();
    haptic('tap');
    const current = runRef.current;
    const t = Date.now();
    if (current.paused) {
      commit(resumeRun({ ...current, timerOn: true }, t));
      return;
    }
    commit(
      current.timerOn
        ? { ...current, timerOn: false, timer: pause(current.timer, t) }
        : { ...current, timerOn: true, timer: start(current.timer, t) },
    );
  };
  const openFinish = () => {
    setListOpen(false);
    setFinishing({ seconds: secondsRun(runRef.current.active) });
  };

  // Keyboard on a desktop or an iPad with a keyboard: space pauses, arrows move.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select')) return;
    if (document.querySelector('dialog[open]')) return;
    if (runRef.current.phase !== 'play') return;
    if (event.key === ' ') {
      event.preventDefault();
      togglePause();
    } else if (event.key === 'ArrowRight') goNext();
    else if (event.key === 'ArrowLeft') goPrevious();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const finish = useMutation({
    mutationFn: async (input: {
      durationSeconds: number;
      feeling: number | null;
      note: string;
    }) => {
      await flush();
      if (queue.current.length) await flush();
      if (queue.current.length) throw new Error('PENDING');
      return trainingApi.finishWorkout(id, input);
    },
    onSuccess: (finished) => {
      session.remove(runKey(id));
      session.remove(pendingKey(id));
      hush();
      haptic('success');
      setFinishing(null);
      queryClient.setQueryData(trainingKeys.workout(id), finished);
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    },
  });

  const leave = () => {
    const current = runRef.current;
    if (current.phase !== 'start' && !current.paused) commit(pauseRun(current, Date.now()));
    hush();
    leavePlayer(navigate, id);
  };

  // ---- what's on screen
  const loggedLabel = (s: WorkStep): string | null => {
    const key = stepKey(s);
    if (!done.has(key)) return null;
    const set = setFor(workout.sets, key);
    if (set) return setLabel(set);
    const waiting = pending.find((p) => p.key === key);
    if (waiting)
      return setLabel({
        reps: waiting.body.reps ?? null,
        weight: waiting.body.weight ?? null,
        seconds: waiting.body.seconds ?? null,
        distance: waiting.body.distance ?? null,
      });
    return t.done;
  };
  const upNextIndex =
    run.phase === 'start'
      ? run.index
      : step?.kind === 'rest'
        ? step.next
        : nextWork(steps, run.index);
  const upNext = steps[upNextIndex];
  const live =
    run.phase === 'ready'
      ? t.live.getReady
      : run.phase === 'end'
        ? t.live.complete
        : run.phase === 'play'
          ? speechFor(steps, run.index)
          : '';

  let main: ReactNode;
  if (run.phase === 'start') {
    main = (
      <StartView
        workout={workout}
        first={steps[run.index]}
        resuming={hasSets}
        total={at.total}
        onStart={begin}
      />
    );
  } else if (run.phase === 'ready') {
    main = <ReadyView run={run} now={now} first={steps[run.index]} onSkip={skipReady} />;
  } else if (run.phase === 'end' || !step) {
    main = <EndView hasSets={hasSets} onFinish={openFinish} onBack={goPrevious} />;
  } else if (step.kind === 'rest') {
    main = (
      <RestView
        step={step}
        run={run}
        now={now}
        next={steps[step.next]}
        onSkip={skipRest}
        onChange={changeRest}
      />
    );
  } else {
    main = (
      <WorkView
        key={run.index}
        step={step}
        run={run}
        now={now}
        values={valuesFor(step)}
        logged={loggedLabel(step)}
        onEdit={(patch) => edit(step, patch)}
        onToggleTimer={toggleTimer}
        onNext={goNext}
        onDone={(values) => {
          logSet(step, values);
          haptic('success');
          afterWork();
        }}
      />
    );
  }

  return (
    <Shell>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <header className="gutter-x shrink-0 pt-[calc(var(--safe-top)+0.5rem)] md:px-6">
        <div className="flex items-center gap-2">
          <RoundButton
            icon={CloseIcon}
            label={t.header.leave}
            onClick={() => (run.phase === 'start' ? leave() : setLeaving(true))}
          />
          <div className="min-w-0 flex-1 px-1">
            <h1 className="truncate text-[1.0625rem] font-bold leading-tight">
              {tr(workout, 'title')}
            </h1>
            <p className="tabular truncate text-sm text-white/60">
              {run.phase === 'end'
                ? t.header.of(at.total, at.total)
                : t.header.of(at.current, at.total)}
              {run.phase !== 'start' ? ` · ${clock(secondsRun(run.active, now))}` : ''}
            </p>
          </div>
          <RoundButton
            icon={sound ? SoundOnIcon : SoundOffIcon}
            label={t.header.sound}
            pressed={sound}
            onClick={() => {
              setSound(!sound);
              if (!sound) unlock();
            }}
          />
          <RoundButton
            icon={ListIcon}
            label={t.header.allSteps}
            className="md:hidden"
            onClick={() => setListOpen(true)}
          />
        </div>
        <div
          className="mt-2.5 h-1 overflow-hidden rounded-pill bg-white/10"
          role="progressbar"
          aria-label={t.header.progress}
          aria-valuemin={0}
          aria-valuemax={at.total}
          aria-valuenow={at.done}
        >
          <div
            className="h-full rounded-pill bg-butter-300 transition-[width] duration-500 ease-(--ease-out)"
            style={{ width: `${at.total ? (at.done / at.total) * 100 : 0}%` }}
          />
        </div>
        {pending.length ? (
          <button
            type="button"
            onClick={() => void flush()}
            className="press mx-auto mt-2 flex h-8 max-w-full items-center gap-1.5 rounded-pill bg-white/10 px-3 text-xs font-semibold text-white/80"
          >
            <SyncIcon fontSize="inherit" className="shrink-0 text-sm" />
            <span className="truncate">{t.header.pending(pending.length)}</span>
          </button>
        ) : null}
      </header>

      <div className="gutter-x relative mt-2 flex min-h-0 flex-1 gap-5 md:px-6">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {main}
          {run.paused && run.phase === 'play' ? (
            <PausedCover
              onResume={togglePause}
              onLeave={() => setLeaving(true)}
              elapsed={clock(secondsRun(run.active, now))}
            />
          ) : null}
        </main>
        <aside className="hidden min-h-0 w-[19rem] shrink-0 flex-col gap-3 pb-3 md:flex lg:w-[23rem]">
          {isWork(upNext) && run.phase !== 'end' ? (
            <UpNext step={upNext} title={run.phase === 'start' ? t.firstUp : t.upNext} />
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.75rem] bg-white/[0.06] p-2">
            <StepList
              steps={steps}
              current={run.phase === 'start' ? -1 : workAt(steps, run.index)}
              done={done}
              dark
              onJump={jump}
            />
          </div>
          {hasSets && run.phase !== 'end' ? (
            <DarkButton tone="ghost" icon={FlagIcon} onClick={openFinish}>
              {t.finishWorkout}
            </DarkButton>
          ) : null}
        </aside>
      </div>

      {run.phase === 'play' || run.phase === 'end' ? (
        <footer className="gutter-x flex shrink-0 items-center justify-center gap-5 pb-[max(0.75rem,var(--safe-bottom))] pt-3 md:px-6">
          <RoundButton
            icon={PreviousIcon}
            label={t.previousStep}
            size="lg"
            disabled={previousWork(steps, run.index) < 0}
            onClick={goPrevious}
          />
          <RoundButton
            icon={run.paused ? PlayIcon : PauseIcon}
            label={run.paused ? t.resume : t.pause}
            size="xl"
            disabled={run.phase === 'end'}
            onClick={togglePause}
          />
          <RoundButton
            icon={NextIcon}
            label={t.nextStep}
            size="lg"
            disabled={run.phase === 'end'}
            onClick={goNext}
          />
        </footer>
      ) : (
        <div className="shrink-0 pb-[max(0.75rem,var(--safe-bottom))]" />
      )}

      {best ? <BestBanner key={best.n} text={best.text} /> : null}

      <Sheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        title={t.steps}
        size="lg"
        footer={
          hasSets && run.phase !== 'end' ? (
            <Button variant="tint" fullWidth icon={FlagIcon} onClick={openFinish}>
              {t.finishWorkout}
            </Button>
          ) : undefined
        }
      >
        <StepList
          key={listOpen ? 'open' : 'closed'}
          steps={steps}
          current={run.phase === 'start' ? -1 : workAt(steps, run.index)}
          done={done}
          onJump={jump}
        />
      </Sheet>

      <Sheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title={t.leaving.title}
        description={pending.length ? t.leaving.pending(pending.length) : t.leaving.saved}
        footer={
          <div className="flex flex-col gap-2.5 md:flex-row-reverse">
            <Button fullWidth onClick={leave}>
              {t.leaving.leave}
            </Button>
            <Button variant="tint" fullWidth onClick={() => setLeaving(false)}>
              {t.leaving.stay}
            </Button>
          </div>
        }
      />

      <FinishSheet
        open={finishing !== null}
        seconds={finishing?.seconds ?? 0}
        sets={done.size}
        saving={finish.isPending}
        error={
          finish.error
            ? finish.error instanceof Error && finish.error.message === 'PENDING'
              ? t.pendingError
              : errorMessage(finish.error)
            : null
        }
        onClose={() => {
          setFinishing(null);
          finish.reset();
        }}
        onSave={(feeling, note) =>
          finish.mutate({ durationSeconds: finishing?.seconds ?? 0, feeling, note })
        }
      />
    </Shell>
  );
}

// ---------------------------------------------------------------- the frame

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-ink-900 text-white">
      {children}
    </div>
  );
}

function Loading() {
  const block = 'rounded-[1.75rem] bg-white/[0.06] motion-safe:animate-pulse';
  const t = usePlayerT();
  return (
    <Shell>
      <div
        className="gutter-x flex flex-1 flex-col items-center gap-4 pt-[calc(var(--safe-top)+1rem)]"
        aria-busy="true"
      >
        <span className="sr-only">{t.open.loading}</span>
        <div className={cx(block, 'h-11 w-full max-w-xl')} />
        <div className={cx(block, 'mt-8 size-28')} />
        <div className={cx(block, 'h-8 w-48')} />
        <div className={cx(block, 'h-24 w-64')} />
        <div
          className={cx(block, 'mt-auto mb-[max(1rem,var(--safe-bottom))] h-16 w-full max-w-md')}
        />
      </div>
    </Shell>
  );
}

function Message({
  title,
  text,
  onClose,
  action,
}: {
  title: string;
  text: string;
  onClose: () => void;
  action?: ReactNode;
}) {
  const t = usePlayerT();
  return (
    <Shell>
      <div className="gutter-x flex pt-[calc(var(--safe-top)+0.5rem)] md:px-6">
        <RoundButton icon={CloseIcon} label={t.open.back} onClick={onClose} />
      </div>
      <div className="gutter-x flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-white/10 text-[1.6rem]">
          <ErrorIcon fontSize="inherit" />
        </span>
        <h1 className="text-h2 font-bold">{title}</h1>
        <p className="max-w-sm text-white/65">{text}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </Shell>
  );
}

function RoundButton({
  icon: Icon,
  label,
  onClick,
  size = 'md',
  disabled,
  pressed,
  className,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => void;
  size?: 'md' | 'lg' | 'xl';
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'press grid shrink-0 place-items-center rounded-full disabled:opacity-35',
        size === 'md' && 'size-11 bg-white/10 text-[1.35rem] hover:bg-white/15',
        size === 'lg' && 'size-14 bg-white/10 text-[1.75rem] hover:bg-white/15',
        size === 'xl' && 'size-[4.5rem] bg-white text-[2.25rem] text-ink-900 hover:bg-lav-50',
        className,
      )}
    >
      <Icon fontSize="inherit" />
    </button>
  );
}

function DarkButton({
  tone,
  icon: Icon,
  onClick,
  children,
  className,
  disabled,
}: {
  tone: 'butter' | 'ghost';
  icon?: IconComponent;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'press inline-flex select-none items-center justify-center gap-2.5 rounded-pill font-bold disabled:opacity-40',
        tone === 'butter'
          ? 'h-16 bg-butter-300 px-8 text-lg text-ink-900 hover:bg-butter-200'
          : 'h-12 bg-white/10 px-5 text-[0.9375rem] text-white hover:bg-white/15',
        className,
      )}
    >
      {Icon ? <Icon fontSize="inherit" className="text-[1.4rem]" /> : null}
      {children}
    </button>
  );
}

function Picture({ icon, className }: { icon: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('grid shrink-0 place-items-center rounded-[1.75rem] bg-lav-100', className)}
    >
      <ExerciseIcon name={icon} className="size-[80%]" />
    </span>
  );
}

/** A countdown ring: the arc is the time left. */
function Ring({
  part,
  tone,
  children,
  className,
}: {
  part: number;
  tone: 'butter' | 'cyan' | 'lav';
  children: ReactNode;
  className?: string;
}) {
  const left = Math.max(0, Math.min(1, 1 - part));
  return (
    <div className={cx('relative grid aspect-square place-items-center', className)}>
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="5" className="stroke-white/10" />
        {left > 0 ? (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100 100"
            strokeDashoffset={100 - left * 100}
            className={cx(
              'transition-[stroke-dashoffset] duration-200 ease-linear motion-reduce:transition-none',
              tone === 'butter' && 'stroke-butter-300',
              tone === 'cyan' && 'stroke-cyan-400',
              tone === 'lav' && 'stroke-lav-400',
            )}
          />
        ) : null}
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}

const RING = 'w-[min(66vw,36dvh,18rem)] md:w-[min(40vw,46dvh,22rem)]';
const HOLD_RING = 'w-[min(60vw,32dvh,16rem)] md:w-[min(36vw,42dvh,20rem)]';

function PausedCover({
  onResume,
  onLeave,
  elapsed,
}: {
  onResume: () => void;
  onLeave: () => void;
  elapsed: string;
}) {
  const t = usePlayerT();
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-[2rem] bg-ink-900/90 text-center motion-safe:animate-fade-in">
      <p className="text-h1 font-bold">{t.paused.title}</p>
      <p className="tabular text-white/60">{t.paused.time(elapsed)}</p>
      <DarkButton tone="butter" icon={PlayIcon} onClick={onResume}>
        {t.resume}
      </DarkButton>
      <button
        type="button"
        onClick={onLeave}
        className="press h-11 rounded-full px-5 text-[0.9375rem] font-semibold text-white/80 hover:bg-white/10"
      >
        {t.paused.leave}
      </button>
    </div>
  );
}

function BestBanner({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+5.5rem)] z-50 flex justify-center px-4"
    >
      <p className="flex items-center gap-2 rounded-pill bg-butter-300 px-5 py-3 text-[0.9375rem] font-bold text-ink-900 shadow-[var(--shadow-float)] motion-safe:animate-pop">
        <SparkleIcon fontSize="inherit" className="text-lg" />
        {text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- the views

function StartView({
  workout,
  first,
  resuming,
  total,
  onStart,
}: {
  workout: Workout;
  first: Step | undefined;
  resuming: boolean;
  total: number;
  onStart: () => void;
}) {
  const t = usePlayerT();
  const words = useTrainingT();
  const facts = [
    words.sets(total),
    workout.estimatedSeconds ? t.start.about(duration(workout.estimatedSeconds)) : null,
    workout.rounds > 1 ? words.rounds(workout.rounds) : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4 text-center">
      {isWork(first) ? (
        <>
          <Picture
            icon={first.item.exercise.icon}
            className="size-28 [@media(max-height:40rem)]:size-20"
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-butter-300">
              {resuming ? t.start.continueWith : t.firstUp}
            </p>
            <h2 className="mt-1.5 text-h1 font-bold">{nameOf(first.item.exercise)}</h2>
            <p className="mt-1 text-white/65">
              {[stepMeta(first), target(first.item, measureOf(first))].filter(Boolean).join(' · ')}
            </p>
          </div>
        </>
      ) : null}
      <p className="text-sm text-white/55">{facts.join(' · ')}</p>
      <DarkButton tone="butter" icon={PlayIcon} onClick={onStart} className="w-full max-w-sm">
        {resuming ? t.start.continue : t.start.start}
      </DarkButton>
    </div>
  );
}

function ReadyView({
  run,
  now,
  first,
  onSkip,
}: {
  run: Run;
  now: number;
  first: Step | undefined;
  onSkip: () => void;
}) {
  const t = usePlayerT();
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label={t.ready.startNow}
      className="flex flex-1 flex-col items-center justify-center gap-6 py-4 text-center"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-butter-300">
        {t.ready.title}
      </p>
      <Ring part={fraction(run.timer, now)} tone="butter" className={RING}>
        <span className="tabular text-[5.5rem] font-bold leading-none">
          {Math.max(1, secondsLeft(run.timer, now))}
        </span>
      </Ring>
      {isWork(first) ? (
        <p className="text-lg font-semibold">
          {nameOf(first.item.exercise)}
          <span className="font-normal text-white/60">
            {' '}
            · {target(first.item, measureOf(first))}
          </span>
        </p>
      ) : null}
      <p className="text-sm text-white/50">{t.ready.tap}</p>
    </button>
  );
}

function EndView({
  hasSets,
  onFinish,
  onBack,
}: {
  hasSets: boolean;
  onFinish: () => void;
  onBack: () => void;
}) {
  const t = usePlayerT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-mint-200 text-[2.5rem] text-mint-800">
        <CheckIcon fontSize="inherit" />
      </span>
      <h2 className="text-h1 font-bold">{hasSets ? t.end.allDone : t.end.nothing}</h2>
      <p className="max-w-xs text-white/65">{hasSets ? t.end.allDoneText : t.end.nothingText}</p>
      {hasSets ? (
        <DarkButton
          tone="butter"
          icon={FlagIcon}
          onClick={onFinish}
          className="mt-2 w-full max-w-sm"
        >
          {t.end.finish}
        </DarkButton>
      ) : (
        <DarkButton tone="ghost" icon={ArrowBackIcon} onClick={onBack} className="mt-2">
          {t.end.back}
        </DarkButton>
      )}
    </div>
  );
}

function RestView({
  step,
  run,
  now,
  next,
  onSkip,
  onChange,
}: {
  step: Extract<Step, { kind: 'rest' }>;
  run: Run;
  now: number;
  next: Step | undefined;
  onSkip: () => void;
  onChange: (seconds: number) => void;
}) {
  const t = usePlayerT();
  const { unit } = useTrainingT();
  const label =
    step.reason === 'side'
      ? t.rest.switchSides
      : step.reason === 'round'
        ? t.rest.betweenRounds
        : t.rest.rest;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-3 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-400">{label}</p>
      <Ring part={fraction(run.timer, now)} tone="cyan" className={RING}>
        <span className="tabular text-[4.25rem] font-bold leading-none md:text-[5rem]">
          {clock(secondsLeft(run.timer, now))}
        </span>
        {run.paused ? <span className="mt-1 text-sm text-white/55">{t.rest.paused}</span> : null}
      </Ring>
      <div className="flex items-center gap-3">
        <TimeChange label={t.rest.less(15)} text={`−15 ${unit.s}`} onClick={() => onChange(-15)} />
        <DarkButton tone="butter" icon={NextIcon} onClick={onSkip} className="h-14 px-7 text-base">
          {t.rest.skip}
        </DarkButton>
        <TimeChange label={t.rest.more(15)} text={`+15 ${unit.s}`} onClick={() => onChange(15)} />
      </div>
      {isWork(next) ? (
        <UpNext step={next} title={t.upNext} className="w-full max-w-md md:hidden" />
      ) : null}
    </div>
  );
}

function TimeChange({
  label,
  text,
  onClick,
}: {
  label: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="press tabular grid h-14 min-w-16 place-items-center rounded-pill bg-white/10 px-4 text-[0.9375rem] font-bold hover:bg-white/15"
    >
      {text}
    </button>
  );
}

function UpNext({ step, title, className }: { step: WorkStep; title: string; className?: string }) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-[1.75rem] bg-white/[0.08] p-3 text-left',
        className,
      )}
    >
      <Picture icon={step.item.exercise.icon} className="size-14 rounded-[1.125rem]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">{title}</p>
        <p className="truncate font-bold">{nameOf(step.item.exercise)}</p>
        <p className="truncate text-sm text-white/60">
          {[target(step.item, measureOf(step)), stepMeta(step)].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
}

function WorkView({
  step,
  run,
  now,
  values,
  logged,
  onEdit,
  onToggleTimer,
  onDone,
  onNext,
}: {
  step: WorkStep;
  run: Run;
  now: number;
  values: Values;
  logged: string | null;
  onEdit: (patch: Partial<Values>) => void;
  onToggleTimer: () => void;
  onDone: (values: Pick<SetInput, 'reps' | 'weight' | 'seconds' | 'distance'>) => void;
  onNext: () => void;
}) {
  const t = usePlayerT();
  const { item } = step;
  const measure = measureOf(step);
  const meta = stepMeta(step);
  const last = lastTime(step);
  // The suggestion often already says what last time was.
  const suggestion = item.suggest?.text ?? null;
  const saysLast = LAST_TIME_PREFIXES.some((prefix) =>
    suggestion?.toLowerCase().startsWith(prefix),
  );
  const hint = (saysLast ? [suggestion] : [last, suggestion]).filter(Boolean).join(' · ');
  const weighted = item.exercise.weighted;
  const ran = secondsRun(run.timer, now);
  const started = isRunning(run.timer) || ran > 0;
  const km = Number.parseFloat(values.km.replace(',', '.'));
  const kmValid = Number.isFinite(km) && km > 0 && km <= 1000;

  let action: ReactNode;
  if (logged) {
    action = (
      <DarkButton tone="butter" icon={NextIcon} onClick={onNext} className="w-full">
        {t.work.next}
      </DarkButton>
    );
  } else if (measure === 'reps') {
    action = (
      <DarkButton
        tone="butter"
        icon={CheckIcon}
        disabled={values.reps < 1}
        onClick={() => onDone({ reps: values.reps, weight: values.weight })}
        className="w-full"
      >
        {t.work.done}
      </DarkButton>
    );
  } else if (measure === 'time') {
    action = started ? (
      <DarkButton
        tone="butter"
        icon={CheckIcon}
        disabled={ran < 1}
        onClick={() => onDone({ seconds: Math.max(1, ran), weight: values.weight })}
        className="w-full"
      >
        {t.work.doneEarly}
      </DarkButton>
    ) : (
      <DarkButton tone="butter" icon={PlayIcon} onClick={onToggleTimer} className="w-full">
        {t.work.startFor(duration(targetSeconds(step)))}
      </DarkButton>
    );
  } else {
    action = (
      <DarkButton
        tone="butter"
        icon={CheckIcon}
        disabled={!kmValid}
        onClick={() => onDone({ distance: Math.round(km * 1000), seconds: ran > 0 ? ran : null })}
        className="w-full"
      >
        {t.work.done}
      </DarkButton>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 py-2 text-center md:justify-center">
      <div className="flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-3 md:flex-none">
        {measure === 'reps' ? (
          <Picture
            icon={item.exercise.icon}
            className="size-24 [@media(max-height:44rem)]:size-16 [@media(max-height:34rem)]:hidden md:size-32"
          />
        ) : null}
        <div className={cx('flex items-center gap-3', measure !== 'reps' && 'text-left')}>
          {measure !== 'reps' ? (
            <Picture icon={item.exercise.icon} className="size-14 rounded-[1.125rem]" />
          ) : null}
          <div className="min-w-0">
            <h2 className="text-h1 font-bold md:text-[2.5rem]">{nameOf(item.exercise)}</h2>
            {meta ? <p className="mt-1 text-[0.9375rem] text-white/60">{meta}</p> : null}
          </div>
        </div>
        <p className="rounded-pill bg-white/10 px-4 py-1.5 text-lg font-bold">
          {target(item, measure)}
        </p>
        {hint ? (
          <p className="max-w-md text-sm text-white/55 [@media(max-height:40rem)]:hidden">{hint}</p>
        ) : null}

        {logged ? (
          <p className="flex max-w-full items-center gap-2 rounded-pill bg-mint-200 px-4 py-2 font-semibold text-mint-800">
            <CheckCircleIcon fontSize="inherit" className="shrink-0 text-lg" />
            <span className="truncate">{t.work.logged(logged)}</span>
          </p>
        ) : measure === 'reps' ? (
          <RepsCounter value={values.reps} onChange={(reps) => onEdit({ reps })} />
        ) : measure === 'time' ? (
          <button
            type="button"
            onClick={onToggleTimer}
            aria-label={run.timerOn && !run.paused ? t.work.pauseTimer : t.work.startTimer}
            className="press rounded-full"
          >
            <Ring part={fraction(run.timer, now)} tone="butter" className={HOLD_RING}>
              <span className="tabular text-[3.75rem] font-bold leading-none md:text-[4.5rem]">
                {clock(secondsLeft(run.timer, now))}
              </span>
              <span className="mt-2 text-[1.75rem] text-white/70">
                {run.timerOn && !run.paused ? (
                  <PauseIcon fontSize="inherit" />
                ) : (
                  <PlayIcon fontSize="inherit" />
                )}
              </span>
            </Ring>
          </button>
        ) : (
          <Stopwatch
            seconds={ran}
            running={run.timerOn && !run.paused}
            km={values.km}
            onKm={(text) => onEdit({ km: text })}
            onToggle={onToggleTimer}
          />
        )}

        {item.exercise.options.length && !logged ? (
          <div className="w-full max-w-md">
            <WayChips
              tone="dark"
              options={item.exercise.options}
              value={values.variant}
              onChange={(variant, option) =>
                onEdit({
                  variant: variant ?? null,
                  ...(option && option.kg !== null ? { weight: option.kg } : {}),
                })
              }
            />
          </div>
        ) : null}

        {weighted && !logged && measure !== 'distance' ? (
          <WeightChips
            options={item.exercise.weights}
            value={values.weight}
            onChange={(weight) => onEdit({ weight })}
          />
        ) : null}
      </div>
      <div className="w-full max-w-md shrink-0">{action}</div>
    </div>
  );
}

function RepsCounter({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const set = (next: number) => onChange(Math.max(0, Math.min(5000, Math.round(next))));
  const t = usePlayerT();
  return (
    <div className="flex items-center gap-3 md:gap-5">
      <button
        type="button"
        aria-label={t.work.oneLess}
        onClick={() => {
          haptic('tap');
          set(value - 1);
        }}
        disabled={value <= 0}
        className="press grid size-14 place-items-center rounded-full bg-white/10 text-[1.75rem] hover:bg-white/15 disabled:opacity-35 md:size-16 md:text-[2rem]"
      >
        <RemoveIcon fontSize="inherit" />
      </button>
      <label className="flex flex-col items-center">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={5000}
          value={value}
          onChange={(event) => set(Number(event.target.value) || 0)}
          onFocus={(event) => event.target.select()}
          className="tabular w-[3.2ch] appearance-none bg-transparent text-center text-[4rem] font-bold md:text-[5rem] leading-none outline-none [-moz-appearance:textfield] focus-visible:rounded-2xl focus-visible:bg-white/10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-sm text-white/55">{t.work.repsUnder(value)}</span>
      </label>
      <button
        type="button"
        aria-label={t.work.oneMore}
        onClick={() => {
          haptic('tap');
          set(value + 1);
        }}
        className="press grid size-14 place-items-center rounded-full bg-white/10 text-[1.75rem] hover:bg-white/15 md:size-16 md:text-[2rem]"
      >
        <AddIcon fontSize="inherit" />
      </button>
    </div>
  );
}

function WeightChips({
  options,
  value,
  onChange,
}: {
  options: Array<{ kg: number; pair: boolean }>;
  value: number | null;
  onChange: (weight: number | null) => void;
}) {
  const t = usePlayerT();
  const words = useTrainingT();
  const byKg = new Map<number, boolean>();
  for (const option of options) byKg.set(option.kg, Boolean(byKg.get(option.kg)) || option.pair);
  if (value !== null && !byKg.has(value)) byKg.set(value, false);
  // Nothing owned to pick from: "No weight" alone would only be noise.
  if (!byKg.size) return null;
  const list = [...byKg.entries()].sort((a, b) => a[0] - b[0]);
  const chip = (on: boolean) =>
    cx(
      'press flex h-11 shrink-0 items-center gap-1 rounded-pill px-4 text-[0.9375rem] font-semibold',
      on ? 'bg-butter-300 text-ink-900' : 'bg-white/10 text-white hover:bg-white/15',
    );
  return (
    <div
      role="group"
      aria-label={t.work.weight}
      className="flex w-fit max-w-full gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={chip(value === null)}
      >
        {t.work.noWeight}
      </button>
      {list.map(([weight, pair]) => (
        <button
          key={weight}
          type="button"
          aria-pressed={value === weight}
          aria-label={`${kg(weight)}${pair ? `, ${words.pairs(1)}` : ''}`}
          onClick={() => onChange(weight)}
          className={chip(value === weight)}
        >
          <span className="tabular">{kg(weight)}</span>
          {pair ? <span className="text-xs opacity-60">×2</span> : null}
        </button>
      ))}
    </div>
  );
}

function Stopwatch({
  seconds,
  running,
  km,
  onKm,
  onToggle,
}: {
  seconds: number;
  running: boolean;
  km: string;
  onKm: (text: string) => void;
  onToggle: () => void;
}) {
  const t = usePlayerT();
  const words = useTrainingT();
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="tabular text-[4rem] font-bold leading-none">{clock(seconds)}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={running ? t.work.stopStopwatch : t.work.startStopwatch}
          className="press grid size-16 place-items-center rounded-full bg-white text-[2rem] text-ink-900"
        >
          {running ? <PauseIcon fontSize="inherit" /> : <PlayIcon fontSize="inherit" />}
        </button>
      </div>
      <label className="flex w-full items-center gap-3 rounded-[1.25rem] bg-white/10 px-4">
        <span className="text-sm font-semibold text-white/65">{words.measure.distance}</span>
        <input
          type="text"
          inputMode="decimal"
          value={km}
          onChange={(event) => onKm(event.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
          onFocus={(event) => event.target.select()}
          className="tabular h-14 min-w-0 flex-1 bg-transparent text-right text-2xl font-bold outline-none"
        />
        <span className="text-white/65">{words.unit.km}</span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------- the list

function StepList({
  steps,
  current,
  done,
  onJump,
  dark,
}: {
  steps: Step[];
  current: number;
  done: Set<string>;
  onJump: (index: number) => void;
  dark?: boolean;
}) {
  const currentRef = useRef<HTMLLIElement>(null);
  const t = usePlayerT();
  useEffect(() => {
    // A frame later: in a sheet, the dialog opens after its content mounts.
    const frame = requestAnimationFrame(() =>
      currentRef.current?.scrollIntoView?.({ block: 'nearest' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [current]);

  const rows: ReactNode[] = [];
  let group = '';
  steps.forEach((step, index) => {
    if (!isWork(step)) return;
    const heading =
      step.block !== 'main'
        ? BLOCK_LABEL[step.block]
        : step.rounds > 1
          ? t.meta.round(step.round, step.rounds)
          : BLOCK_LABEL.main;
    if (heading !== group) {
      group = heading;
      rows.push(
        <li
          key={`h${index}`}
          className={cx(
            'px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.12em] first:pt-1',
            dark ? 'text-white/45' : 'text-ink-500',
          )}
        >
          {heading}
        </li>,
      );
    }
    const isDone = done.has(stepKey(step));
    const isCurrent = index === current;
    rows.push(
      <li key={index} ref={isCurrent ? currentRef : undefined}>
        <button
          type="button"
          aria-current={isCurrent ? 'step' : undefined}
          onClick={() => onJump(index)}
          className={cx(
            'press flex w-full items-center gap-3 rounded-[1.25rem] p-2 text-left',
            dark
              ? isCurrent
                ? 'bg-white/[0.12] ring-2 ring-inset ring-butter-300'
                : 'hover:bg-white/[0.06]'
              : isCurrent
                ? 'bg-lav-100 ring-2 ring-inset ring-lav-600'
                : 'hover:bg-ink-50',
          )}
        >
          <Picture icon={step.item.exercise.icon} className="size-11 rounded-[0.875rem]" />
          <span className="min-w-0 flex-1">
            <span className={cx('block truncate font-semibold', isDone && 'opacity-60')}>
              {nameOf(step.item.exercise)}
            </span>
            <span className={cx('block truncate text-sm', dark ? 'text-white/55' : 'text-ink-600')}>
              {[
                step.item.sets > 1 ? t.meta.setN(step.setNumber) : null,
                step.side ? t.meta.side(step.side) : null,
                target(step.item, measureOf(step)),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span
            aria-label={isDone ? t.done : undefined}
            className={cx(
              'grid size-7 shrink-0 place-items-center rounded-full text-base',
              isDone
                ? 'bg-mint-200 text-mint-800'
                : dark
                  ? 'ring-2 ring-inset ring-white/15'
                  : 'ring-2 ring-inset ring-ink-200',
            )}
          >
            {isDone ? <CheckIcon fontSize="inherit" /> : null}
          </span>
        </button>
      </li>,
    );
  });
  return <ol className="flex flex-col gap-1">{rows}</ol>;
}

// ---------------------------------------------------------------- finishing

/** 1 (very hard) to 5 (great); the words are playerT().feeling[value - 1]. */
const FEELINGS: Array<{ value: number; icon: IconComponent }> = [
  { value: 1, icon: FeelVeryHardIcon },
  { value: 2, icon: FeelHardIcon },
  { value: 3, icon: FeelOkIcon },
  { value: 4, icon: FeelGoodIcon },
  { value: 5, icon: FeelGreatIcon },
];
const feelingLabel = (value: number) => playerT().feeling[value - 1] ?? '';

function FinishSheet({
  open,
  seconds,
  sets,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  seconds: number;
  sets: number;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (feeling: number | null, note: string) => void;
}) {
  const [feeling, setFeeling] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const t = usePlayerT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.finish.title}
      footer={
        <Button
          fullWidth
          icon={CheckIcon}
          loading={saving}
          onClick={() => onSave(feeling, note.trim())}
        >
          {t.finish.save}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t.finish.timeTrained} value={clock(seconds)} />
        <Stat label={t.finish.setsDone} value={String(sets)} />
      </div>
      <fieldset className="mt-5">
        <legend className="text-[0.8125rem] font-semibold text-ink-700">{t.finish.feel}</legend>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {FEELINGS.map(({ value, icon: Icon }) => {
            const label = feelingLabel(value);
            const on = feeling === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  haptic('tap');
                  setFeeling(on ? null : value);
                }}
                className={cx(
                  'press flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-[1.125rem] px-1 text-xs font-semibold',
                  on ? 'bg-butter-300 text-ink-900' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                )}
              >
                <Icon fontSize="inherit" className="text-[1.75rem]" />
                <span className="max-w-full hyphens-auto break-words leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <TextField
        className="mt-5"
        label={t.finish.note}
        placeholder={t.finish.notePlaceholder}
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}

function Stat({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={cx('rounded-[1.25rem] p-3.5', dark ? 'bg-white/[0.08]' : 'bg-ink-50')}>
      <p className={cx('text-xs font-semibold', dark ? 'text-white/55' : 'text-ink-600')}>
        {label}
      </p>
      <p className="tabular mt-0.5 text-h2 font-bold">{value}</p>
    </div>
  );
}

/** "10, 12, 11 reps · 8 kg", "45 s, 50 s", "3.2 km in 18:40". */
function compactSets(sets: TrainingSet[]): string {
  if (sets.every((s) => s.reps !== null && !s.distance)) {
    const weights = [...new Set(sets.map((s) => s.weight ?? 0))];
    const reps = playerT().summary.repsList(
      sets.map((s) => s.reps).join(', '),
      sets.at(-1)?.reps ?? 0,
    );
    if (weights.length === 1) return weights[0] ? `${reps} · ${kg(weights[0])}` : reps;
    return sets.map((s) => setLabel(s)).join(', ');
  }
  if (sets.every((s) => s.seconds !== null && !s.distance && s.reps === null))
    return sets.map((s) => duration(s.seconds ?? 0)).join(', ');
  return sets.map((s) => setLabel(s)).join(', ');
}

function Summary({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const [bests] = useState(() => readJson<Best[]>(bestsKey(workout.id)) ?? []);
  const sets = workout.sets;
  const reps = sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  const metres = sets.reduce((sum, s) => sum + (s.distance ?? 0), 0);
  const groups: Array<{ id: string; name: string; icon: string; sets: TrainingSet[] }> = [];
  for (const set of sets) {
    const group = groups.find((g) => g.id === set.exerciseId);
    if (group) group.sets.push(set);
    else
      groups.push({ id: set.exerciseId, name: tr(set, 'exercise'), icon: set.icon, sets: [set] });
  }
  const t = usePlayerT();
  const { unit } = useTrainingT();
  const feeling = FEELINGS.find((f) => f.value === workout.feeling);

  return (
    <div className="min-h-dvh bg-ink-900 text-white">
      <div className="gutter-x mx-auto flex max-w-2xl flex-col gap-6 pb-[calc(max(1rem,var(--safe-bottom))+5.5rem)] pt-[calc(var(--safe-top)+1.5rem)] md:px-6">
        <header className="flex flex-col items-center gap-3 text-center motion-safe:animate-rise">
          <span className="grid size-20 place-items-center rounded-full bg-mint-200 text-[2.5rem] text-mint-800">
            <CheckIcon fontSize="inherit" />
          </span>
          <h1 className="text-h1 font-bold">{t.summary.saved}</h1>
          <p className="text-white/65">
            {tr(workout, 'title')}
            {feeling ? ` · ${t.felt(feelingLabel(feeling.value))}` : ''}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat dark label={t.summary.time} value={clock(workout.durationSeconds ?? 0)} />
          <Stat dark label={t.summary.sets} value={String(sets.length)} />
          <Stat dark label={t.summary.reps} value={String(reps)} />
          <Stat dark label={t.summary.energy} value={`${workout.kcal} ${unit.kcal}`} />
          {metres ? <Stat dark label={t.summary.distance} value={distance(metres)} /> : null}
        </div>

        {bests.length ? (
          <section>
            <h2 className="text-h3 font-bold">{t.summary.bests}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {bests.map((b, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 rounded-[1.25rem] bg-butter-300 p-2.5 pr-4 text-ink-900"
                >
                  <Picture icon={b.icon} className="size-11 rounded-[0.875rem] bg-butter-100" />
                  <span className="min-w-0 flex-1 font-semibold">{b.exercise}</span>
                  <span className="text-sm font-bold">
                    {b.kinds.map((k) => RECORD_LABEL[k]).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {groups.length ? (
          <section>
            <h2 className="text-h3 font-bold">{t.summary.whatYouDid}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-[1.25rem] bg-white/[0.06] p-2.5"
                >
                  <Picture icon={g.icon} className="size-12 rounded-[0.875rem]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{g.name}</span>
                    <span className="block text-sm text-white/60">{compactSets(g.sets)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {workout.note ? (
          <p className="rounded-[1.25rem] bg-white/[0.06] p-4 text-white/80">{workout.note}</p>
        ) : null}
      </div>
      <div className="gutter-x fixed inset-x-0 bottom-0 flex justify-center bg-ink-900 pb-[max(1rem,var(--safe-bottom))] pt-3">
        <DarkButton
          tone="butter"
          icon={CheckIcon}
          onClick={() => navigate('/training', { replace: true })}
          className="w-full max-w-md"
        >
          {t.summary.done}
        </DarkButton>
      </div>
    </div>
  );
}
