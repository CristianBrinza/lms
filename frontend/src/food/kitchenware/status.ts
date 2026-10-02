import { useSyncExternalStore } from 'react';
import type { Tool, ToolKind } from '../types';

/** How kitchenware reads on screen: kinds, counts, the dishwasher's clock. Pure, except useNow. */

export const KIND_LABEL: Record<ToolKind, string> = {
  cookware: 'Cookware',
  bakeware: 'Bakeware',
  utensil: 'Utensils',
  dishes: 'Dishes',
  bar: 'Bar',
  appliance: 'Appliances',
  other: 'Other',
};

export const KIND_ORDER = Object.keys(KIND_LABEL) as ToolKind[];

export interface WashState {
  /** Things in the kitchen (each kind counted once). */
  kinds: number;
  dirty: number;
  /** Dirty and dishwasher-safe: what "Start dishwasher" would take. */
  dirtyWashable: number;
  washing: number;
  /** When the dishwasher's whole load is clean (the latest run end), or null. */
  cleanAt: string | null;
}

export function washState(tools: Tool[]): WashState {
  let dirty = 0;
  let dirtyWashable = 0;
  let washing = 0;
  let cleanAt: string | null = null;
  for (const tool of tools) {
    dirty += tool.dirty;
    if (tool.washable) dirtyWashable += tool.dirty;
    washing += tool.washing;
    if (tool.washing > 0 && tool.washingUntil && (!cleanAt || tool.washingUntil > cleanAt)) cleanAt = tool.washingUntil;
  }
  return { kinds: tools.length, dirty, dirtyWashable, washing, cleanAt };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "21:40", on the device's clock. */
export function clock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "3 h", "2 h 15 min", "45 min". */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Minutes left until `iso` (to the nearest minute, at least 1 until it is over, never below 0). */
export function minutesLeft(iso: string, now: number): number {
  const ms = new Date(iso).getTime() - now;
  return ms <= 0 ? 0 : Math.max(1, Math.round(ms / 60_000));
}

/** The one line under "Kitchenware": "All clean", "3 dirty · dishwasher until 21:40". */
export function statusLine(state: WashState): string {
  if (!state.kinds) return 'Count your pots, pans and glasses';
  const parts: string[] = [];
  if (state.dirty) parts.push(`${state.dirty} dirty`);
  if (state.washing && state.cleanAt) parts.push(`dishwasher until ${clock(state.cleanAt)}`);
  return parts.length ? parts.join(' · ') : 'All clean';
}

/** One thing's state as short chips: "2 of 3 clean", "1 dirty", "1 washing". */
export function toolChips(tool: Tool): Array<{ label: string; tone: 'mint' | 'peach' | 'cyan' | 'muted' }> {
  if (!tool.washable) return [{ label: `×${tool.count}`, tone: 'muted' }];
  if (tool.count === 0) return [{ label: 'None', tone: 'muted' }];
  const chips: Array<{ label: string; tone: 'mint' | 'peach' | 'cyan' | 'muted' }> = [];
  if (tool.clean === tool.count) chips.push({ label: tool.count === 1 ? 'Clean' : `All ${tool.count} clean`, tone: 'mint' });
  else if (tool.clean > 0) chips.push({ label: `${tool.clean} of ${tool.count} clean`, tone: 'mint' });
  if (tool.dirty) chips.push({ label: tool.count === 1 ? 'Dirty' : `${tool.dirty} dirty`, tone: 'peach' });
  if (tool.washing) chips.push({ label: tool.count === 1 ? 'Washing' : `${tool.washing} washing`, tone: 'cyan' });
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
