import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton, Sheet, Spinner, toast } from '@/components/ui';
import {
  CameraIcon,
  CloseIcon,
  FileIcon,
  AddIcon,
  MicIcon,
  PhotoLibraryIcon,
  SendIcon,
  StopIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { assistantApi } from './api';
import { useAssistantT } from './i18n';
import {
  MAX_FILE_BYTES,
  MAX_RECORD_SECONDS,
  readAsDataUrl,
  recorderMime,
  shrinkImage,
} from './media';

interface Pending {
  key: string;
  name: string;
  kind: 'image' | 'file';
  preview?: string;
  status: 'uploading' | 'ready' | 'error';
  id?: string;
}

type Voice = 'idle' | 'recording' | 'transcribing';

interface ComposerProps {
  /** True while a reply is being written: the send button becomes Stop. */
  busy: boolean;
  stopping: boolean;
  onSend: (text: string, attachmentIds: string[]) => Promise<boolean>;
  onStop: () => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function Tile({ icon: Icon, label, onClick }: { icon: typeof CameraIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl bg-lav-100 px-2 py-5 text-ink-900 hover:bg-lav-200"
    >
      <span className="text-[2rem]">
        <Icon fontSize="inherit" />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

/** The text box with its + (camera, photos, files), the dictate button and Send / Stop. */
export function Composer({ busy, stopping, onSend, onStop }: ComposerProps) {
  const t = useAssistantT();
  const [text, setText] = useState('');
  const [items, setItems] = useState<Pending[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [voice, setVoice] = useState<Voice>('idle');
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(stopTimer.current);
      if (recorder.current && recorder.current.state !== 'inactive') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // The box grows with what is typed, up to about eight lines.
  useLayoutEffect(() => {
    const node = area.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [text]);

  const patch = useCallback((key: string, change: Partial<Pending>) => {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const addFile = useCallback(
    async (file: File) => {
      const key = crypto.randomUUID();
      const isImage = file.type.startsWith('image/') && file.type !== 'image/svg+xml';
      if (!isImage && file.size > MAX_FILE_BYTES) {
        toast.error(t.fileTooBig);
        return;
      }
      setItems((list) => [
        ...list,
        { key, name: file.name, kind: isImage ? 'image' : 'file', status: 'uploading' },
      ]);
      try {
        if (isImage) {
          try {
            const { dataUrl, preview } = await shrinkImage(file);
            patch(key, { preview: URL.createObjectURL(preview) });
            const saved = await assistantApi.upload({
              kind: 'image',
              name: file.name || 'photo.jpg',
              mime: 'image/jpeg',
              data: dataUrl,
            });
            patch(key, { status: 'ready', id: saved.id });
            return;
          } catch (error) {
            // A picture this browser can't read (or that the server refused): send it as a file.
            if (file.size > MAX_FILE_BYTES) throw error;
            patch(key, { kind: 'file', preview: undefined });
          }
        }
        const saved = await assistantApi.upload({
          kind: 'file',
          name: file.name,
          mime: file.type || 'application/octet-stream',
          data: await readAsDataUrl(file),
        });
        patch(key, { status: 'ready', id: saved.id });
      } catch {
        patch(key, { status: 'error' });
        toast.error(t.uploadFailed);
      }
    },
    [patch, t],
  );

  const pick = (list: FileList | null) => {
    setAddOpen(false);
    if (!list) return;
    for (const file of Array.from(list)) void addFile(file);
  };

  const remove = (item: Pending) => {
    setItems((list) => list.filter((other) => other.key !== item.key));
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (item.id) void assistantApi.removeAttachment(item.id).catch(() => undefined);
  };

  // ---- voice
  const transcribe = useCallback(
    async (blob: Blob, seconds: number) => {
      try {
        const saved = await assistantApi.upload({
          kind: 'audio',
          name: 'voice',
          mime: blob.type || 'audio/mp4',
          data: await readAsDataUrl(blob),
          durationSec: seconds,
        });
        let result = await assistantApi.transcribe(saved.id);
        // The server waits up to 90 s; after that we ask every 1.5 s, for up to four minutes.
        for (let n = 0; n < 160 && (result.status === 'queued' || result.status === 'running'); n++) {
          await sleep(1500);
          if (!mounted.current) return;
          result = await assistantApi.transcript(saved.id);
        }
        if (!mounted.current) return;
        if (result.status === 'done' && result.text) {
          // Into the box to check and fix; nothing is sent until Send is tapped.
          setText((current) => (current.trim() ? `${current.trimEnd()} ${result.text}` : result.text));
          area.current?.focus();
        } else {
          toast.error(t.transcribeFailed);
        }
      } catch {
        if (mounted.current) toast.error(t.transcribeFailed);
      } finally {
        if (mounted.current) setVoice('idle');
      }
    },
    [t],
  );

  const stopRecording = useCallback(() => {
    clearTimeout(stopTimer.current);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }, []);

  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error(t.micDenied);
      return;
    }
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error(t.micDenied);
      return;
    }
    stream.current = media;
    const mime = recorderMime();
    const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    rec.onstop = () => {
      media.getTracks().forEach((track) => track.stop());
      stream.current = null;
      recorder.current = null;
      if (!mounted.current) return;
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/mp4').split(';')[0] });
      if (!blob.size) {
        setVoice('idle');
        return;
      }
      setVoice('transcribing');
      void transcribe(blob, Math.ceil((Date.now() - startedAt) / 1000));
    };
    recorder.current = rec;
    rec.start();
    haptic('tap');
    setVoice('recording');
    stopTimer.current = setTimeout(stopRecording, MAX_RECORD_SECONDS * 1000 - 1000);
  };

  // ---- send
  const uploading = items.some((item) => item.status === 'uploading');
  const ready = items.filter((item) => item.status === 'ready' && item.id);
  const canSend = !sending && !uploading && voice !== 'transcribing' && (text.trim() !== '' || ready.length > 0);

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    haptic('tap');
    const ok = await onSend(
      text.trim(),
      ready.map((item) => item.id!),
    );
    if (!mounted.current) return;
    setSending(false);
    if (ok) {
      items.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
      setItems([]);
      setText('');
    }
  };

  const status: ReactNode =
    voice === 'recording' ? (
      <span className="inline-flex items-center gap-2 text-danger-700">
        <span className="size-2 animate-pulse rounded-full bg-danger-600" />
        {t.recording}
      </span>
    ) : voice === 'transcribing' ? (
      <span className="inline-flex items-center gap-2">
        <Spinner className="size-4" />
        {t.transcribing}
      </span>
    ) : null;

  return (
    <div className="border-t border-ink-100 bg-white px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-2">
      {items.length ? (
        <ul className="flex gap-2 overflow-x-auto pb-2" aria-label={t.attach}>
          {items.map((item) => (
            <li key={item.key} className="relative shrink-0">
              {item.kind === 'image' && item.preview ? (
                <img src={item.preview} alt="" className="size-16 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-16 max-w-40 items-center gap-2 rounded-2xl bg-lav-100 px-3 text-sm">
                  <FileIcon fontSize="small" />
                  <span className="truncate">{item.name}</span>
                </span>
              )}
              {item.status === 'uploading' ? (
                <span className="absolute inset-0 grid place-items-center rounded-2xl bg-white/60">
                  <Spinner label={t.uploading} />
                </span>
              ) : null}
              {item.status === 'error' ? (
                <span className="absolute inset-0 rounded-2xl ring-2 ring-inset ring-danger-600" />
              ) : null}
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`${t.removeAttachment}: ${item.name}`}
                className="press absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink-900 text-[0.9rem] text-white"
              >
                <CloseIcon fontSize="inherit" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {status ? <p className="px-1 pb-1 text-sm text-ink-600">{status}</p> : null}
      <div className="flex items-end gap-2">
        <IconButton icon={AddIcon} label={t.attach} variant="soft" size="sm" onClick={() => setAddOpen(true)} />
        <textarea
          ref={area}
          value={text}
          rows={1}
          onChange={(event) => setText(event.target.value)}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          enterKeyHint="send"
          className="max-h-[200px] min-h-10 min-w-0 flex-1 resize-none rounded-3xl bg-lav-50 px-4 py-2.5 text-base text-ink-900 outline-none ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-lav-600"
        />
        <IconButton
          icon={voice === 'recording' ? StopIcon : MicIcon}
          label={voice === 'recording' ? t.micStop : t.mic}
          variant={voice === 'recording' ? 'accent' : 'ghost'}
          size="sm"
          disabled={voice === 'transcribing'}
          onClick={() => (voice === 'recording' ? stopRecording() : void startRecording())}
        />
        {busy ? (
          <IconButton
            icon={StopIcon}
            label={stopping ? t.stopping : t.stop}
            variant="ink"
            size="sm"
            disabled={stopping}
            onClick={onStop}
          />
        ) : (
          <IconButton
            icon={SendIcon}
            label={t.send}
            variant="ink"
            size="sm"
            disabled={!canSend}
            onClick={() => void submit()}
          />
        )}
      </div>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={library}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={files}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = '';
        }}
      />
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t.add}>
        <div className={cx('flex gap-3')}>
          <Tile icon={CameraIcon} label={t.camera} onClick={() => camera.current?.click()} />
          <Tile icon={PhotoLibraryIcon} label={t.photos} onClick={() => library.current?.click()} />
          <Tile icon={FileIcon} label={t.files} onClick={() => files.current?.click()} />
        </div>
      </Sheet>
    </div>
  );
}
