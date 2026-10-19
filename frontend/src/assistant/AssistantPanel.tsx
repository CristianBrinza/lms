import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IconButton, Spinner, toast } from '@/components/ui';
import {
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  FileIcon,
  NewChatIcon,
  SparkleIcon,
  WarningIcon,
} from '@/components/ui/icons';
import { intlLocale } from '@/i18n';
import { cx } from '@/lib/cx';
import { lockScroll } from '@/lib/scroll-lock';
import { storage } from '@/lib/storage';
import { useWide } from '@/lib/useMediaQuery';
import { isApiError } from '@/services/api/client';
import {
  assistantApi,
  assistantKeys,
  isBusy,
  type AssistantMessage,
  type Mode,
} from './api';
import { Composer } from './Composer';
import { useAssistantT } from './i18n';
import { Markdown } from './Markdown';

const THREAD_KEY = 'lms.assistant.thread';
const CLOSE_MS = 200;

const time = (iso: string) =>
  new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function Bubble({ message, main }: { message: AssistantMessage; main: boolean }) {
  const t = useAssistantT();
  const mine = message.role === 'user';
  const working = message.status === 'queued' || message.status === 'running';
  const lastStep = message.steps.at(-1);
  return (
    <li className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div
        className={cx(
          'max-w-[88%] rounded-3xl px-4 py-2.5 text-[0.9375rem] leading-relaxed',
          mine ? 'rounded-br-lg bg-ink-900 text-white' : 'rounded-bl-lg bg-lav-100 text-ink-900',
        )}
      >
        {message.attachments.length ? (
          <ul className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) =>
              attachment.kind === 'image' ? (
                <li key={attachment.id}>
                  <a href={attachment.url} target="_blank" rel="noreferrer">
                    <img
                      src={attachment.url}
                      alt={t.image}
                      loading="lazy"
                      className="max-h-48 max-w-full rounded-2xl object-cover"
                    />
                  </a>
                </li>
              ) : (
                <li
                  key={attachment.id}
                  className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-sm"
                >
                  <FileIcon fontSize="small" />
                  <span className="max-w-40 truncate">{attachment.name}</span>
                </li>
              ),
            )}
          </ul>
        ) : null}
        {mine ? (
          message.text ? (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          ) : null
        ) : message.text ? (
          <Markdown text={message.text} />
        ) : working ? null : (
          <p className="text-ink-600">
            {message.status === 'stopped' ? t.stoppedNote : message.status === 'failed' ? t.failedNote : ''}
          </p>
        )}
        {!mine && working ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            <Spinner className="size-3.5" />
            <span className="truncate">
              {main
                ? lastStep
                  ? `${t.mainWorking} ${lastStep}`
                  : t.sentToMain
                : (lastStep ?? (message.status === 'queued' ? t.queued : t.working))}
            </span>
          </p>
        ) : null}
        {!mine && working && main ? <p className="mt-1 text-xs text-ink-500">{t.mainHint}</p> : null}
        {!mine && message.status === 'failed' && message.error ? (
          <p className="mt-1 text-sm text-danger-700">{message.error}</p>
        ) : null}
        {!mine && message.status === 'stopped' && message.text ? (
          <p className="mt-1 text-sm text-ink-500">{t.stoppedNote}</p>
        ) : null}
      </div>
      <time dateTime={message.createdAt} className="mt-1 px-2 text-xs text-ink-500">
        {time(message.createdAt)}
      </time>
    </li>
  );
}

/**
 * The assistant: a bottom sheet on phones (it can grow to full screen) and a side panel on
 * tablets and desktops. Replies are fetched again whenever the server announces a change in the
 * 'assistant' live area, and every 1.5 s while one is being written.
 */
export default function AssistantPanel({ onClose }: { onClose: () => void }) {
  const t = useAssistantT();
  const wide = useWide();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const releaseScroll = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  // undefined: not chosen yet (the latest conversation); null: a new one, made on the first message.
  const [threadId, setThreadId] = useState<string | null | undefined>(
    () => storage.get(THREAD_KEY) ?? undefined,
  );
  const [pendingMode, setPendingMode] = useState<Mode>('main');

  const threads = useQuery({
    queryKey: assistantKeys.threads,
    queryFn: assistantApi.threads,
    enabled: threadId === undefined,
  });
  // Not chosen yet: the latest conversation, once the list is here.
  const wanted =
    threadId === undefined ? (threads.data ? (threads.data[0]?.id ?? null) : undefined) : threadId;

  const conversation = useQuery({
    queryKey: assistantKeys.messages(wanted ?? ''),
    queryFn: () => assistantApi.messages(wanted!),
    enabled: Boolean(wanted),
    // Live sync normally tells us; asking every 1.5 s while a reply is running is the fallback.
    refetchInterval: (query) => (isBusy(query.state.data?.messages ?? []) ? 1500 : false),
    retry: (count, error) => !(isApiError(error) && error.status === 404) && count < 2,
  });
  // A conversation that is gone (deleted elsewhere): start a new one.
  const gone = isApiError(conversation.error) && conversation.error.status === 404;
  const current = gone ? null : (wanted ?? null);

  const messages = gone ? [] : (conversation.data?.messages ?? []);
  const mode: Mode = (gone ? undefined : conversation.data?.thread.mode) ?? pendingMode;
  const busy = isBusy(messages);
  const running = messages.findLast((m) => m.role === 'assistant' && (m.status === 'queued' || m.status === 'running'));

  // Stay at the bottom while new words arrive, unless the person scrolled up to read.
  const last = messages.at(-1);
  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const near = node.scrollHeight - node.scrollTop - node.clientHeight < 160;
    if (near || messages.length <= 2) node.scrollTo({ top: node.scrollHeight });
  }, [messages.length, last?.text, last?.status, last?.steps.length]);

  const changeMode = useMutation({
    mutationFn: (next: Mode) => assistantApi.setMode(current!, next),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: assistantKeys.all }),
  });
  const pickMode = (next: Mode) => {
    if (next === mode) return;
    setPendingMode(next);
    if (current) changeMode.mutate(next);
  };

  const stop = useMutation({
    mutationFn: (id: string) => assistantApi.stop(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: assistantKeys.all }),
  });

  const send = useCallback(
    async (text: string, attachmentIds: string[]) => {
      try {
        let id = current;
        if (!id) {
          const created = await assistantApi.createThread(pendingMode);
          id = created.id;
          storage.set(THREAD_KEY, id);
          setThreadId(id);
        }
        await assistantApi.send(id, text, attachmentIds);
        await queryClient.invalidateQueries({ queryKey: assistantKeys.all });
        return true;
      } catch (error) {
        toast.error(isApiError(error, 'BUSY') ? t.busy : t.sendFailed);
        return false;
      }
    },
    [current, pendingMode, queryClient, t],
  );

  const newChat = () => {
    storage.remove(THREAD_KEY);
    setThreadId(null);
  };

  // ---- the dialog: the platform's focus trap, Escape and inert page, as in Sheet.
  const requestClose = useCallback(() => {
    const node = dialog.current;
    if (!node || closing.current) return;
    closing.current = true;
    node.dataset.state = 'closed';
    const done = () => {
      closing.current = false;
      if (node.open) node.close();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else window.setTimeout(done, CLOSE_MS);
  }, []);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.dataset.state = 'closed';
    node.showModal();
    releaseScroll.current = lockScroll();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        node.dataset.state = 'open';
      });
    });
    const onClosed = () => {
      releaseScroll.current?.();
      releaseScroll.current = null;
      onClose();
    };
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    node.addEventListener('close', onClosed);
    node.addEventListener('cancel', onCancel);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      node.removeEventListener('close', onClosed);
      node.removeEventListener('cancel', onCancel);
      releaseScroll.current?.();
      releaseScroll.current = null;
    };
  }, [onClose, requestClose]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === dialog.current) requestClose();
      }}
      className={cx(
        'group fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none touch-none overflow-visible bg-transparent text-ink-900',
        'open:flex open:items-end open:justify-center md:open:items-stretch md:open:justify-end md:p-3',
      )}
    >
      <div
        className={cx(
          'flex w-full flex-col overflow-hidden bg-white shadow-[0_30px_60px_-24px_rgb(42_43_102/0.55)] outline-none',
          'rounded-t-[2rem] md:h-full md:w-[28rem] md:rounded-[2rem]',
          expanded && !wide ? 'h-full pt-[var(--safe-top)]' : 'h-[75dvh]',
          'translate-y-8 opacity-0 transition-[translate,opacity] md:translate-x-8 md:translate-y-0',
          'group-data-[state=open]:translate-x-0 group-data-[state=open]:translate-y-0 group-data-[state=open]:opacity-100 group-data-[state=open]:duration-[340ms] group-data-[state=open]:ease-(--ease-out)',
          'group-data-[state=closed]:duration-200 group-data-[state=closed]:ease-(--ease-in-out)',
        )}
      >
        <header className="flex items-center gap-2 px-4 pb-2 pt-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lav-100 text-[1.25rem] text-lav-700">
            <SparkleIcon fontSize="inherit" />
          </span>
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-h2 font-bold">
            {t.title}
          </h2>
          <IconButton icon={NewChatIcon} label={t.newChat} variant="soft" size="sm" onClick={newChat} />
          {!wide ? (
            <IconButton
              icon={expanded ? CollapseIcon : ExpandIcon}
              label={expanded ? t.collapse : t.expand}
              variant="soft"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
            />
          ) : null}
          <button
            type="button"
            onClick={requestClose}
            aria-label={t.close}
            title={t.close}
            className="press flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[1.2rem] text-white hover:bg-ink-800"
          >
            <CloseIcon fontSize="inherit" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
          <div role="radiogroup" aria-label={t.modeLabel} className="flex rounded-full bg-lav-100 p-0.5">
            {(['main', 'assistant', 'developer'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => pickMode(value)}
                className={cx(
                  'press h-8 rounded-full px-3.5 text-sm font-semibold',
                  mode === value ? 'bg-ink-900 text-white' : 'text-ink-700',
                )}
              >
                {t.modes[value]}
              </button>
            ))}
          </div>
          {mode === 'developer' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-peach-100 px-3 py-1 text-xs font-semibold text-peach-800">
              <WarningIcon fontSize="inherit" />
              {t.developerWarning}
            </span>
          ) : null}
        </div>

        <div ref={list} className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-3">
          {conversation.isPending && current ? (
            <div className="grid h-full place-items-center text-ink-500">
              <Spinner />
            </div>
          ) : messages.length ? (
            <ul className="space-y-3" aria-live="polite">
              {messages.map((message) => (
                <Bubble key={message.id} message={message} main={mode === 'main'} />
              ))}
            </ul>
          ) : (
            <p className="mx-auto mt-10 max-w-xs text-center text-ink-600">{t.empty}</p>
          )}
        </div>

        <Composer
          busy={busy}
          stopping={Boolean(running?.stopRequested) || stop.isPending}
          onSend={send}
          onStop={() => running && stop.mutate(running.id)}
        />
      </div>
    </dialog>
  );
}
