import { useSyncExternalStore } from 'react';
import { intlLocale } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { STORAGE_KEYS, storage } from '@/lib/storage';

/**
 * The player's sound and voice: short beeps made on the spot with an oscillator (no audio files
 * to download or cache) and the browser's own speech for "Push-ups. 10 reps." Remembered per
 * device; off means silent, the vibrations stay. iOS only lets a page make sound after a tap,
 * so the first Start / Resume calls unlock().
 */

// ---------------------------------------------------------------- on or off

const listeners = new Set<() => void>();
let soundOn = storage.get(STORAGE_KEYS.trainingSound) !== 'off';

export function setSound(on: boolean) {
  soundOn = on;
  storage.set(STORAGE_KEYS.trainingSound, on ? 'on' : 'off');
  if (!on) hush();
  listeners.forEach((listener) => listener());
}

export function useSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => soundOn,
    () => soundOn,
  );
  return [on, setSound];
}

// ---------------------------------------------------------------- beeps

type AudioContextClass = typeof AudioContext;
let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (audio) return audio;
  const Ctor: AudioContextClass | undefined =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    audio = new Ctor();
  } catch {
    audio = null;
  }
  return audio;
}

/** Call from a tap: wakes the audio and speech so later beeps and words are allowed (iOS). */
export function unlock() {
  const ctx = context();
  if (ctx) {
    void ctx.resume().catch(() => undefined);
    try {
      // A silent blip, played inside the gesture, is what really unlocks iOS Safari.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Nothing to unlock.
    }
  }
  if (soundOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    } catch {
      // No voice here.
    }
  }
}

function tone(frequency: number, at: number, length: number, volume = 0.22) {
  const ctx = context();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  const start = ctx.currentTime + at;
  // A soft attack and a quick fade: a clean beep without a click.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.02);
}

export type Beep = 'tick' | 'end' | 'best';

/** 3-2-1 ticks, the long tone at the end of a timer, a little rising chime for a new best. */
export function beep(kind: Beep) {
  if (!soundOn || (typeof document !== 'undefined' && document.hidden)) return;
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  try {
    if (kind === 'tick') tone(880, 0, 0.12);
    else if (kind === 'end') tone(1320, 0, 0.42, 0.26);
    else {
      tone(988, 0, 0.14);
      tone(1319, 0.12, 0.14);
      tone(1760, 0.24, 0.32);
    }
  } catch {
    // Audio refused: stay quiet.
  }
}

// ---------------------------------------------------------------- voice

/** Says a step out loud, cutting off whatever was being said. */
export function say(text: string) {
  if (!soundOn || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (document.hidden) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // The app's language: en-GB, ro-MD or ru-RU (a phone without that voice picks its nearest).
    utterance.lang = intlLocale();
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  } catch {
    // No voice here.
  }
}

export function hush() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window)
      window.speechSynthesis.cancel();
  } catch {
    // Nothing to stop.
  }
}

// ---------------------------------------------------------------- together

/** A countdown passed a whole second: ticks on 3, 2, 1. */
export function countdownTick(secondsLeft: number) {
  if (secondsLeft >= 1 && secondsLeft <= 3) beep('tick');
}

/** A timer ran out. */
export function timerEnd() {
  beep('end');
  haptic('success');
}

/** A set beat a personal best. */
export function newBest() {
  beep('best');
  haptic('success');
}

/** A new step begins: a light tap and its words. */
export function stepStart(text: string) {
  haptic('tap');
  say(text);
}
