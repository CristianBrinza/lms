import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, IconButton, Skeleton, Spinner, toast } from '@/components/ui';
import { AddIcon } from '@/components/ui/icons';
import type { IconComponent } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodKeys, kitchenwareApi } from '../api';
import { plural } from '../format';
import { FoodIcon, FoodIconTile } from '../icons/FoodIcon';
import { AddToolSheet } from '../kitchenware/AddToolSheet';
import { DishwasherSheet } from '../kitchenware/DishwasherSheet';
import { CheckCircleIcon, DishwasherIcon, HandWashIcon, TuneIcon } from '../kitchenware/icons';
import { clock, duration, KIND_LABEL, KIND_ORDER, minutesLeft, toolChips, useNow, washState, type WashState } from '../kitchenware/status';
import { ToolSheet } from '../kitchenware/ToolSheet';
import type { Tool } from '../types';

type KitchenwareList = Awaited<ReturnType<typeof kitchenwareApi.list>>;

/**
 * The kitchen's pots, pans, glasses (and pens): how many, which are dirty, what's in the
 * dishwasher and when it's done. Cooking makes things dirty; washing by hand cleans them now,
 * the dishwasher when its run is over. Phones: the washing-up on top, then the kinds as lists.
 * Tablets and up: the washing-up as a bar with its actions inline, the kinds in columns of cards.
 */
export default function KitchenwarePage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: foodKeys.kitchenware, queryFn: kitchenwareApi.list });
  const [adding, setAdding] = useState(false);
  const [dishwasher, setDishwasher] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });

  const tools = list.data?.tools ?? [];
  const state = washState(tools);
  const editTool = tools.find((tool) => tool.id === editing.id) ?? null;
  const groups = KIND_ORDER.map((kind) => ({ kind, items: tools.filter((tool) => tool.kind === kind) })).filter((group) => group.items.length);

  /** Writes what the server answered into the list at once (counts move under the thumb). */
  const putTools = (next: Tool[]) =>
    queryClient.setQueryData<KitchenwareList>(foodKeys.kitchenware, (old) => (old ? { ...old, tools: next } : old));
  const putTool = (next: Tool) =>
    queryClient.setQueryData<KitchenwareList>(foodKeys.kitchenware, (old) =>
      old ? { ...old, tools: old.tools.map((tool) => (tool.id === next.id ? next : tool)) } : old,
    );

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/food"
        title="Kitchenware"
        subtitle={list.data ? (tools.length ? plural(tools.length, 'thing') : 'Nothing counted yet') : ' '}
        actions={<IconButton icon={AddIcon} label="Add kitchenware" variant="ink" size="sm" onClick={() => setAdding(true)} />}
      />

      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {list.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 rounded-3xl md:h-20" />
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-40 rounded-3xl" />
              <Skeleton className="h-40 rounded-3xl" />
            </div>
          </div>
        ) : list.error ? (
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">Couldn’t load the kitchenware</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(list.error)}</p>
            <Button size="sm" variant="tint" className="mt-3" onClick={() => void list.refetch()}>
              Try again
            </Button>
          </div>
        ) : !tools.length ? (
          <Empty onAdd={() => setAdding(true)} />
        ) : (
          <>
            <WashPanel state={state} runMinutes={list.data.dishwasherMinutes} onTools={putTools} onSettings={() => setDishwasher(true)} />
            <div className="mt-4 md:columns-2 md:gap-4 2xl:columns-3">
              {groups.map((group) => (
                <section key={group.kind} className="mb-3.5 break-inside-avoid">
                  <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold">
                    {KIND_LABEL[group.kind]}
                    <span className="tabular text-sm font-semibold text-ink-500">{group.items.length}</span>
                  </h2>
                  <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
                    {group.items.map((tool) => (
                      <ToolRow
                        key={tool.id}
                        tool={tool}
                        onOpen={() => setEditing({ id: tool.id, open: true })}
                        onTool={putTool}
                        onTools={putTools}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      <AddToolSheet open={adding} onClose={() => setAdding(false)} tools={tools} presets={list.data?.presets ?? []} />
      <ToolSheet open={editing.open && Boolean(editTool)} tool={editTool} icons={list.data?.icons ?? []} onClose={() => setEditing((e) => ({ ...e, open: false }))} />
      <DishwasherSheet open={dishwasher} minutes={list.data?.dishwasherMinutes ?? 180} onClose={() => setDishwasher(false)} />
    </Screen>
  );
}

// ---------------------------------------------------------------- the washing-up

function WashPanel({
  state,
  runMinutes,
  onTools,
  onSettings,
}: {
  state: WashState;
  runMinutes: number;
  onTools: (tools: Tool[]) => void;
  onSettings: () => void;
}) {
  const queryClient = useQueryClient();
  const now = useNow();
  const left = state.cleanAt ? minutesLeft(state.cleanAt, now) : null;
  const done = left === 0;

  // The run is over: the server settles the load on the next read.
  useEffect(() => {
    if (done) void queryClient.invalidateQueries({ queryKey: foodKeys.kitchenware });
  }, [done, queryClient]);

  const run = useMutation({
    mutationFn: (how: 'hand' | 'machine' | 'unload') => (how === 'unload' ? kitchenwareApi.unload() : kitchenwareApi.wash({ how })),
    onSuccess: (tools, how) => {
      haptic('success');
      onTools(tools);
      const after = washState(tools);
      if (how === 'hand') toast.success('All washed and clean');
      else if (how === 'unload') toast.success('Dishwasher unloaded', { description: 'Everything is clean and back' });
      else toast.success('Dishwasher started', { description: after.cleanAt ? `Clean at ${clock(after.cleanAt)}` : undefined });
      void queryClient.invalidateQueries({ queryKey: foodKeys.kitchenware });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const washing = state.washing > 0 && state.cleanAt !== null;
  const tone = washing ? 'bg-cyan-200 text-cyan-800' : state.dirty ? 'bg-peach-200 text-peach-800' : 'bg-mint-200 text-mint-800';
  const Icon = washing ? DishwasherIcon : state.dirty ? HandWashIcon : CheckCircleIcon;
  const headline = [state.dirty ? `${state.dirty} dirty` : null, washing ? `${state.washing} in the dishwasher` : null].filter(Boolean).join(' · ') || 'All clean';
  const detail = washing
    ? `Clean at ${clock(state.cleanAt!)}${left ? ` · ${duration(left)} left` : ''}`
    : state.dirty
      ? state.dirtyWashable
        ? 'Wash by hand or start the dishwasher'
        : 'Wash them by hand'
      : 'Nothing waiting to be washed';

  return (
    <section aria-label="Washing up" className="rounded-[1.5rem] bg-white p-3 shadow-[var(--shadow-raised)] md:flex md:items-center md:gap-4 md:p-3 md:pl-3.5">
      <div className="flex min-w-0 items-center gap-3 md:flex-1">
        <span aria-hidden="true" className={cx('grid size-12 shrink-0 place-items-center rounded-2xl text-[1.6rem]', tone)}>
          <Icon fontSize="inherit" />
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate text-[1.0625rem] font-bold leading-tight">{headline}</p>
          <p className="tabular mt-0.5 text-[0.8125rem] font-medium leading-snug text-ink-600">{detail}</p>
        </div>
        <button
          type="button"
          onClick={onSettings}
          aria-label={`Dishwasher run time: ${duration(runMinutes)}. Change`}
          title="Dishwasher run time"
          className="press flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-pill px-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 sm:px-3"
        >
          <TuneIcon fontSize="inherit" className="text-[1.2rem]" />
          <span className="tabular max-sm:sr-only">{duration(runMinutes)}</span>
        </button>
      </div>
      {state.dirty || washing ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:flex md:shrink-0">
          {state.dirty ? (
            <Action icon={HandWashIcon} tone="tint" onClick={() => run.mutate('hand')} busy={run.isPending && run.variables === 'hand'} disabled={run.isPending}>
              Wash by hand
            </Action>
          ) : null}
          {state.dirtyWashable ? (
            <Action icon={DishwasherIcon} tone="ink" onClick={() => run.mutate('machine')} busy={run.isPending && run.variables === 'machine'} disabled={run.isPending}>
              {washing ? 'Add to dishwasher' : 'Start dishwasher'}
            </Action>
          ) : null}
          {washing ? (
            <Action icon={CheckCircleIcon} tone="outline" onClick={() => run.mutate('unload')} busy={run.isPending && run.variables === 'unload'} disabled={run.isPending}>
              Unload now
            </Action>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const ACTION_TONES = {
  ink: 'bg-ink-900 text-white hover:bg-ink-800 shadow-[0_10px_20px_-12px_rgb(29_29_36/0.8)]',
  tint: 'bg-lav-100 text-ink-900 hover:bg-lav-200',
  outline: 'bg-white text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
} as const;

/** A 44px pill that fits two to a phone row (the big Button's padding doesn't). */
function Action({
  icon: Icon,
  tone,
  onClick,
  busy,
  disabled,
  children,
}: {
  icon: IconComponent;
  tone: keyof typeof ACTION_TONES;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cx(
        'press inline-flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 text-[0.9375rem] font-semibold last:odd:col-span-2 disabled:opacity-50',
        ACTION_TONES[tone],
      )}
    >
      {busy ? <Spinner className="size-4 shrink-0" /> : <Icon fontSize="inherit" className="shrink-0 text-[1.15rem] max-sm:hidden" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------- one thing

const CHIP_TONES = {
  mint: 'bg-mint-100 text-mint-800',
  peach: 'bg-peach-100 text-peach-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  muted: 'bg-ink-100 text-ink-700',
} as const;

function ToolRow({ tool, onOpen, onTool, onTools }: { tool: Tool; onOpen: () => void; onTool: (tool: Tool) => void; onTools: (tools: Tool[]) => void }) {
  const queryClient = useQueryClient();
  const settled = () => void queryClient.invalidateQueries({ queryKey: foodKeys.kitchenware });
  const used = useMutation({
    mutationFn: () => kitchenwareApi.used(tool.id),
    onSuccess: (next) => {
      haptic('tap');
      onTool(next);
      settled();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const washed = useMutation({
    mutationFn: () => kitchenwareApi.wash({ how: 'hand', toolIds: [tool.id] }),
    onSuccess: (tools) => {
      haptic('success');
      onTools(tools);
      settled();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const chips = toolChips(tool);
  const quick = 'press grid h-11 shrink-0 place-items-center rounded-pill text-sm font-semibold transition-colors disabled:opacity-35';

  return (
    <li className="flex items-center">
      <button type="button" onClick={onOpen} className="press flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-2.5 pr-2 text-left transition-colors hover:bg-ink-50">
        <FoodIconTile name={tool.icon} className="size-11 rounded-[0.875rem] [&>svg]:size-8" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{tool.name}</span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
            {chips.map((chip) => (
              <span key={chip.label} className={cx('tabular inline-flex h-6 items-center whitespace-nowrap rounded-pill px-2 text-xs font-semibold', CHIP_TONES[chip.tone])}>
                {chip.label}
              </span>
            ))}
            {tool.place ? <span className="min-w-0 truncate pl-0.5 text-xs font-medium text-ink-500">{tool.place}</span> : null}
          </span>
        </span>
      </button>
      {tool.washable ? (
        <span className="flex shrink-0 items-center gap-1 pr-2">
          <button
            type="button"
            onClick={() => used.mutate()}
            disabled={used.isPending || tool.clean === 0}
            aria-label={`Used one ${tool.name}`}
            title="Used one: it's dirty now"
            className={cx(quick, 'bg-ink-50 px-3 text-ink-800 hover:bg-peach-100')}
          >
            Used
          </button>
          <button
            type="button"
            onClick={() => washed.mutate()}
            disabled={washed.isPending || tool.dirty === 0}
            aria-label={`Washed ${tool.name} by hand`}
            title="Washed by hand"
            className={cx(quick, 'w-11 bg-ink-50 text-[1.2rem] text-ink-800 hover:bg-mint-100')}
          >
            <HandWashIcon fontSize="inherit" />
          </button>
        </span>
      ) : null}
    </li>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-9 text-center shadow-[var(--shadow-card)]">
      <div className="flex items-end gap-1" aria-hidden="true">
        <FoodIcon name="pan" className="size-14" />
        <FoodIcon name="big-pot" className="size-20" />
        <FoodIcon name="glass" className="size-12" />
      </div>
      <h2 className="mt-4 text-h2 font-bold">Count your kitchenware</h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">
        Pots, pans, glasses, even pens. Cooking makes them dirty; washing by hand or the dishwasher brings them back.
      </p>
      <Button icon={AddIcon} className="mt-6" onClick={onAdd}>
        Add kitchenware
      </Button>
    </div>
  );
}
