import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/app/auth';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Chips, Sheet, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, CloseIcon, ContentCopyIcon, KeyIcon, WarningIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatAgo, formatDate } from '@/lib/format';
import { foodKeys, keysApi } from '@/food/api';
import type { AccessKey } from '@/food/types';
import { HubIcon, TerminalIcon } from './icons';

type Scope = AccessKey['scope'];

const SCOPE_LABEL: Record<Scope, string> = {
  'food:read': 'Read only',
  food: 'Kitchen',
  admin: 'Everything',
};
const SCOPE_HINT: Record<Scope, string> = {
  'food:read': 'Claude can look at the kitchen, recipes, lists and plan, and change nothing.',
  food: 'Claude can read and change everything in Food.',
  admin: 'Food, plus managing people’s accounts.',
};

const origin = () => window.location.origin;

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error('Couldn’t copy. Select it and copy by hand.');
  }
}

/**
 * Keys that let Claude use LMS as you: over the REST API or the MCP endpoint. A key is shown once,
 * when it is made. Nothing here calls an AI; Claude calls LMS. Tablets and up: keys beside the how-to.
 */
export default function AiAccessPage() {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: foodKeys.keys, queryFn: keysApi.list });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<AccessKey | null>(null);

  const revoke = useMutation({
    mutationFn: (id: string) => keysApi.revoke(id),
    onSuccess: () => {
      toast.success(`${revoking?.name ?? 'Key'} revoked`, { description: 'It stopped working.' });
      setRevoking(null);
      void queryClient.invalidateQueries({ queryKey: foodKeys.keys });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/settings"
        title="Claude access"
        subtitle="Keys for Claude to read and run the kitchen"
      />

      <div className="gutter-x mt-3 md:grid md:grid-cols-2 md:items-start md:gap-4 md:px-5 lg:gap-6 lg:px-8">
        <section aria-labelledby="keys-title">
          <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
            <h2 id="keys-title" className="text-[0.9375rem] font-bold">
              Access keys
            </h2>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="press -my-1 flex h-11 shrink-0 items-center gap-1 rounded-pill bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
            >
              <AddIcon fontSize="inherit" className="text-[1.15rem]" />
              New key
            </button>
          </div>
          <div className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
            {keys.isPending ? (
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ) : keys.error ? (
              <div className="p-4">
                <p className="font-semibold text-danger-700">Couldn’t load your keys</p>
                <p className="mt-1 text-sm text-ink-600">{errorMessage(keys.error)}</p>
              </div>
            ) : !keys.data.length ? (
              <p className="p-4 text-[0.9375rem] text-ink-600">
                No keys yet. Make one, then give it to Claude.
              </p>
            ) : (
              keys.data.map((key) => (
                <div key={key.id} className="flex items-center gap-3 py-2.5 pl-3.5 pr-2">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-lav-100 text-[1.25rem] text-lav-800"
                  >
                    <KeyIcon fontSize="inherit" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[0.9375rem] font-semibold">{key.name}</span>
                      <span className="shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
                        {SCOPE_LABEL[key.scope]}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-600">
                      <span className="font-mono text-[0.8125rem]">{key.prefix}…</span> ·{' '}
                      {key.lastUsedAt
                        ? `used ${formatAgo(key.lastUsedAt).toLowerCase()}`
                        : `made ${formatDate(key.createdAt)}, not used yet`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevoking(key)}
                    aria-label={`Revoke ${key.name}`}
                    title="Revoke"
                    className="press grid size-11 shrink-0 place-items-center rounded-full text-[1.25rem] text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <CloseIcon fontSize="inherit" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <HowTo className="mt-4 md:mt-0" />
      </div>

      <NewKeySheet open={creating} onClose={() => setCreating(false)} />
      <ConfirmSheet
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
        loading={revoke.isPending}
        title={`Revoke ${revoking?.name ?? 'this key'}?`}
        description="Anything using this key stops working at once."
        confirmLabel="Revoke"
        tone="danger"
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- making a key

function NewKeySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [name, setName] = useState('Claude');
  const [scope, setScope] = useState<Scope>('food');
  const [made, setMade] = useState<{ token: string; key: AccessKey } | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName('Claude');
      setScope('food');
      setMade(null);
    }
  }

  const create = useMutation({
    mutationFn: () => keysApi.create({ name: name.trim(), scope }),
    onSuccess: (result) => {
      setMade(result);
      void queryClient.invalidateQueries({ queryKey: foodKeys.keys });
    },
  });
  const fields = fieldErrors(create.error);
  const scopes = (
    isAdmin ? (['food:read', 'food', 'admin'] as const) : (['food:read', 'food'] as const)
  ).map((value) => ({ value, label: SCOPE_LABEL[value] }));

  if (made) {
    const connector = `${origin()}/api/mcp/k/${made.token}`;
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title="Your new key"
        footer={
          <Button fullWidth onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2.5 rounded-2xl bg-butter-100 p-3 text-sm font-medium text-ink-800">
            <WarningIcon
              fontSize="inherit"
              className="mt-0.5 shrink-0 text-[1.15rem] text-butter-800"
            />
            Copy it now. It won’t be shown again; if it’s lost, make a new one.
          </p>
          <CopyBlock label="Key" value={made.token} what="Key" />
          <CopyBlock
            label="Connector URL (has the key in it)"
            value={connector}
            what="Connector URL"
          />
          <p className="text-sm text-ink-600">
            {made.key.name} · {SCOPE_LABEL[made.key.scope]}. {SCOPE_HINT[made.key.scope]}
          </p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New key for Claude"
      footer={
        <div className="flex flex-col gap-2">
          {create.isError && !Object.keys(fields).length ? (
            <p className="text-sm font-medium text-danger-600">{errorMessage(create.error)}</p>
          ) : null}
          <Button
            fullWidth
            icon={KeyIcon}
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!name.trim()}
          >
            Make the key
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <TextField
          label="Name"
          placeholder="Claude on my laptop"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fields.name}
          maxLength={60}
        />
        <div>
          <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">What Claude may do</p>
          <Chips
            label="What Claude may do"
            tone="sheet"
            dense
            value={scope}
            onChange={setScope}
            options={scopes}
          />
          <p className="mt-1.5 text-sm text-ink-600">{SCOPE_HINT[scope]}</p>
        </div>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------- how Claude connects

function CopyBlock({
  label,
  value,
  what,
  className,
}: {
  label: string;
  value: string;
  what: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[0.8125rem] font-semibold text-ink-700">{label}</p>
      <div className="flex items-start gap-1 rounded-2xl bg-ink-50 py-1 pl-3 pr-1 ring-1 ring-inset ring-ink-100">
        <code className="min-w-0 flex-1 select-all break-all py-2 font-mono text-[0.8125rem] leading-snug text-ink-900">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void copy(value, what)}
          aria-label={`Copy ${what.toLowerCase()}`}
          title="Copy"
          className="press grid size-11 shrink-0 place-items-center rounded-xl text-[1.15rem] text-ink-700 hover:bg-white hover:text-ink-900"
        >
          <ContentCopyIcon fontSize="inherit" />
        </button>
      </div>
    </div>
  );
}

function HowTo({ className }: { className?: string }) {
  const base = origin();
  return (
    <section
      aria-labelledby="howto-title"
      className={cx(
        'rounded-[1.5rem] bg-white p-3.5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70',
        className,
      )}
    >
      <h2 id="howto-title" className="text-[1rem] font-bold">
        How Claude connects
      </h2>
      <p className="mt-0.5 text-sm text-ink-600">
        The key acts as you, with the access you picked. Nothing in LMS calls an AI.
      </p>

      <div className="mt-3.5 flex items-center gap-2 text-[0.9375rem] font-bold">
        <HubIcon fontSize="inherit" className="text-[1.2rem] text-lav-700" aria-hidden="true" />
        MCP
      </div>
      <p className="mt-0.5 text-sm text-ink-600">
        For the claude.ai or desktop app, add a custom connector with the URL from your new key:
      </p>
      <CopyBlock
        className="mt-1.5"
        label="Connector URL"
        value={`${base}/api/mcp/k/<key>`}
        what="Connector URL"
      />
      <p className="mt-2.5 text-sm text-ink-600">
        Clients that send headers, like Claude Code, use the plain endpoint:
      </p>
      <CopyBlock
        className="mt-1.5"
        label="Claude Code"
        value={`claude mcp add --transport http lms ${base}/api/mcp --header "Authorization: Bearer <key>"`}
        what="Command"
      />

      <div className="mt-3.5 flex items-center gap-2 text-[0.9375rem] font-bold">
        <TerminalIcon
          fontSize="inherit"
          className="text-[1.2rem] text-lav-700"
          aria-hidden="true"
        />
        REST API
      </div>
      <p className="mt-0.5 text-sm text-ink-600">
        Everything under{' '}
        <code className="font-mono text-[0.8125rem] text-ink-900">{base}/api/food/…</code> with the
        key in a header:
      </p>
      <CopyBlock
        className="mt-1.5"
        label="Example"
        value={`curl -H "Authorization: Bearer <key>" ${base}/api/food/kitchen`}
        what="Example"
      />
    </section>
  );
}
