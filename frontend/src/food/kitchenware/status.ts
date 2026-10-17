import { useSyncExternalStore } from 'react';
import type { Tool, ToolKind } from '../types';
import { kitchenwareT } from './i18n';

/** How kitchenware reads on screen: kinds, counts, the dishwasher's clock. Pure, except useNow. */

export const KIND_ORDER: ToolKind[] = [
  'cookware',
  'bakeware',
  'utensil',
  'dishes',
  'bar',
  'appliance',
  'disposable',
  'other',
];

/** A kind's name in the current language: "Cookware", "Vase de gătit", "Для готовки". */
export const kindLabel = (kind: ToolKind) => kitchenwareT().kind[kind];

export interface WashState {
  /** Things in the kitchen (each kind counted once). */
  kinds: number;
  dirty: number;
  /** Dirty and dishwasher-safe: what "Start dishwasher" would take. */
  dirtyWashable: number;
  /** Dirty and washed by hand only (knives, the grill): the dishwasher leaves these. */
  byHand: number;
  /** Single-use things running low (baking paper, foil). */
  low: number;
  washing: number;
  /** When the dishwasher's whole load is clean (the latest run end), or null. */
  cleanAt: string | null;
}

export function washState(tools: Tool[]): WashState {
  let dirty = 0;
  let dirtyWashable = 0;
  let byHand = 0;
  let low = 0;
  let washing = 0;
  let cleanAt: string | null = null;
  for (const tool of tools) {
    dirty += tool.dirty;
    if (tool.washable && tool.dishwasherSafe) dirtyWashable += tool.dirty;
    else if (tool.washable) byHand += tool.dirty;
    if (tool.low) low += 1;
    washing += tool.washing;
    if (tool.washing > 0 && tool.washingUntil && (!cleanAt || tool.washingUntil > cleanAt))
      cleanAt = tool.washingUntil;
  }
  return { kinds: tools.length, dirty, dirtyWashable, byHand, low, washing, cleanAt };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "21:40", on the device's clock. */
export function clock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "3 h", "2 h 15 min", "45 min" ("3 ч 15 мин" in Russian). */
export function duration(minutes: number): string {
  const t = kitchenwareT();
  const m = Math.max(0, Math.round(minutes));
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  if (!hours) return `${rest} ${t.minutes}`;
  return rest ? `${hours} ${t.hours} ${rest} ${t.minutes}` : `${hours} ${t.hours}`;
}

/** Minutes left until `iso` (to the nearest minute, at least 1 until it is over, never below 0). */
export function minutesLeft(iso: string, now: number): number {
  const ms = new Date(iso).getTime() - now;
  return ms <= 0 ? 0 : Math.max(1, Math.round(ms / 60_000));
}

/** The one line under "Kitchenware": "All clean", "3 dirty · dishwasher until 21:40". */
export function statusLine(state: WashState): string {
  const t = kitchenwareT();
  if (!state.kinds) return t.statusEmpty;
  const parts: string[] = [];
  if (state.dirty)
    parts.push(
      state.byHand && state.byHand === state.dirty
        ? t.toWashByHand(state.dirty)
        : t.dirtyCount(state.dirty),
    );
  if (state.washing && state.cleanAt) parts.push(t.dishwasherUntil(clock(state.cleanAt)));
  return parts.length ? parts.join(' · ') : t.allClean;
}

/** One thing's state as short chips: "2 of 3 clean", "1 dirty", "1 washing". */
export function toolChips(
  tool: Tool,
): Array<{ label: string; tone: 'mint' | 'peach' | 'cyan' | 'muted' }> {
  const t = kitchenwareT();
  if (tool.kind === 'disposable')
    return [
      {
        label: tool.count ? t.left(tool.count, tool.low) : t.noneLeft,
        tone: tool.low ? 'peach' : 'muted',
      },
    ];
  if (!tool.washable) return [{ label: `×${tool.count}`, tone: 'muted' }];
  if (tool.count === 0) return [{ label: t.none, tone: 'muted' }];
  const chips: Array<{ label: string; tone: 'mint' | 'peach' | 'cyan' | 'muted' }> = [];
  if (tool.clean === tool.count)
    chips.push({ label: tool.count === 1 ? t.clean : t.allNClean(tool.count), tone: 'mint' });
  else if (tool.clean > 0) chips.push({ label: t.nOfClean(tool.clean, tool.count), tone: 'mint' });
  if (tool.dirty)
    chips.push({
      label: `${tool.count === 1 ? t.dirty : t.dirtyCount(tool.dirty)}${tool.dishwasherSafe ? '' : t.byHand}`,
      tone: 'peach',
    });
  if (tool.washing)
    chips.push({
      label: tool.count === 1 ? t.washing : t.washingCount(tool.washing),
      tone: 'cyan',
    });
  return chips;
}

// ---------------------------------------------------------------- a shared clock

let now = Date.now();
const listeners = new Set<() => void>();
let timer: number | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 15_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

const getNow = () => now;

/** The time, refreshed every 15 seconds while something on screen counts down. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getNow, getNow);
}
