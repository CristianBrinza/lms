import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, toast } from '@/components/ui';
import { FavoriteIcon, SyncIcon } from '@/components/ui/icons';
import {
  nativeApp,
  NATIVE_EVENT,
  type LMSNative,
  type NativeEvent,
  type NativeHealthStatus,
} from '@/lib/native';
import { trainingKeys } from '../api';
import { useAppleHealthT } from './AppleHealth.i18n';

/**
 * The iPhone part of "Connect the phone". Inside the LMS app for iPhone (ios/), a real
 * "Connect Apple Health" and the sync's state; in a browser, one line saying where to get it.
 */
export function AppleHealth() {
  const t = useAppleHealthT();
  const native = nativeApp();
  if (!native) return <p className="mt-3 text-sm text-ink-600">{t.getApp}</p>;
  return <NativeHealth native={native} />;
}

function NativeHealth({ native }: { native: LMSNative }) {
  const t = useAppleHealthT();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NativeHealthStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    native.health
      .status()
      .then((next) => {
        if (alive) setStatus(next);
      })
      .catch(() => undefined);
    // The app says when a sync starts and ends (on opening, in the background, from here).
    const onNative = (event: Event) => {
      const detail = (event as CustomEvent<NativeEvent>).detail;
      if (detail?.type !== 'health') return;
      setStatus(detail.status);
      if (!detail.status.syncing)
        void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    };
    window.addEventListener(NATIVE_EVENT, onNative);
    return () => {
      alive = false;
      window.removeEventListener(NATIVE_EVENT, onNative);
    };
  }, [native, queryClient]);

  const errorText = (code: string | null | undefined) => (code && t.error[code]) || t.error.other;

  const run = async (action: 'connect' | 'sync') => {
    setBusy(true);
    try {
      const next =
        action === 'connect' ? await native.health.connect() : await native.health.syncNow();
      setStatus(next);
      if (next.lastError) toast.error(errorText(next.lastError));
      else toast.success(t.synced);
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    } catch (error) {
      toast.error(errorText(error instanceof Error ? error.message : null));
    } finally {
      setBusy(false);
    }
  };

  if (status && !status.available)
    return <p className="mt-3 text-sm text-ink-600">{t.error.healthUnavailable}</p>;

  if (!status?.connected)
    return (
      <div className="mt-3 flex flex-col items-start gap-2 text-sm">
        <p className="text-ink-600">{t.intro}</p>
        <Button
          size="sm"
          variant="primary"
          icon={FavoriteIcon}
          loading={busy}
          disabled={!status}
          onClick={() => void run('connect')}
        >
          {t.connect}
        </Button>
        <span className="text-xs text-ink-600">{t.connectHint}</span>
      </div>
    );

  return (
    <div className="mt-3 flex flex-col items-start gap-2 text-sm">
      <p className="text-ink-800">{status.syncing ? t.syncing : t.connected}</p>
      {status.lastError ? (
        <p className="font-semibold text-danger-700">{errorText(status.lastError)}</p>
      ) : status.lastSync ? (
        <p className="text-ink-600">{t.sent(status.days, status.workouts)}</p>
      ) : null}
      <Button
        size="sm"
        variant="tint"
        icon={SyncIcon}
        loading={busy || status.syncing}
        onClick={() => void run('sync')}
      >
        {t.syncNow}
      </Button>
      <span className="text-xs text-ink-600">{t.manage}</span>
    </div>
  );
}
