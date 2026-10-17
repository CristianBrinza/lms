import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, PasswordField, Sheet, TextField, toast } from '@/components/ui';
import { DownloadIcon, UploadIcon, WarningIcon } from '@/components/ui/icons';
import { errorMessage } from '@/lib/errors';
import { useAdminT } from './i18n';

/**
 * The whole database, out and back in (admins, in the app only). Download takes a fresh export;
 * restore asks for the password and the word RESTORE, keeps a safety export of what's there now,
 * and changes nothing if the file is wrong.
 */
export default function BackupsPage() {
  const t = useAdminT();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/admin/backup', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(t.backupFailed);
      const blob = await response.blob();
      const name =
        /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
        'lms.dump';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(t.backupReady(name));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const restore = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/octet-stream',
          'x-lms-confirm': word,
          'x-lms-password': password,
        },
        body: file,
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: { detail?: string } };
      } | null;
      if (!response.ok)
        throw new Error(
          [body?.error?.message, body?.error?.fields?.detail].filter(Boolean).join(': ') ||
            t.backupFailed,
        );
    },
    onSuccess: () => {
      toast.success(t.restored);
      // Everything on screen may be different now: start fresh.
      setTimeout(() => window.location.assign('/'), 1200);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Screen tone="white">
      <PageHeader title={t.backups} back="/settings" />
      <div className="gutter-x mx-auto mt-4 flex max-w-2xl flex-col gap-5 lg:px-8">
        <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
          <h2 className="text-h3 font-bold">{t.downloadTitle}</h2>
          <p className="mt-1 text-sm text-ink-600">{t.downloadBody}</p>
          <Button
            className="mt-4"
            icon={DownloadIcon}
            loading={downloading}
            onClick={() => void download()}
          >
            {t.downloadButton}
          </Button>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
          <h2 className="text-h3 font-bold">{t.restoreTitle}</h2>
          <p className="mt-1 text-sm text-ink-600">{t.restoreBody}</p>
          <input
            ref={input}
            type="file"
            accept=".dump,application/octet-stream"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            className="mt-4"
            variant="tint"
            icon={UploadIcon}
            onClick={() => input.current?.click()}
          >
            {t.chooseBackup}
          </Button>
        </section>
      </div>

      <Sheet
        open={file !== null}
        onClose={() => {
          setFile(null);
          setPassword('');
          setWord('');
          if (input.current) input.current.value = '';
        }}
        title={t.restoreConfirmTitle}
      >
        {file ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (word === 'RESTORE' && password) restore.mutate();
            }}
          >
            <div className="flex gap-3 rounded-2xl bg-peach-100 p-4 text-sm text-peach-800">
              <WarningIcon fontSize="inherit" className="mt-0.5 shrink-0 text-lg" />
              <p>{t.restoreWarning(file.name, Math.max(1, Math.round(file.size / 1024)))}</p>
            </div>
            <PasswordField
              label={t.yourPassword}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              label={t.typeRestore}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            <Button
              type="submit"
              variant="danger"
              fullWidth
              loading={restore.isPending}
              disabled={word !== 'RESTORE' || !password}
            >
              {t.restoreButton}
            </Button>
          </form>
        ) : null}
      </Sheet>
    </Screen>
  );
}
