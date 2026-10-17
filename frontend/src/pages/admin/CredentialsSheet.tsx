import { Button, Sheet, toast } from '@/components/ui';
import { CheckIcon, ContentCopyIcon, IosShareIcon } from '@/components/ui/icons';
import { haptic } from '@/lib/haptics';
import { useState } from 'react';
import { useAdminT } from './i18n';

interface CredentialsSheetProps {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
  /** Shown once: the server keeps only its hash. */
  password: string;
  reason: 'created' | 'reset';
}

/**
 * The one moment a one-time password is visible: copy it or share the sign-in details, then it's
 * gone. The person chooses their own at first sign-in.
 */
export function CredentialsSheet({
  open,
  onClose,
  name,
  email,
  password,
  reason,
}: CredentialsSheetProps) {
  const t = useAdminT();
  const url = `${window.location.origin}/login`;
  const message = t.message(url, email, password, `${window.location.origin}/app`);

  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, what: 'password' | 'details') => {
    try {
      await navigator.clipboard.writeText(text);
      haptic('success');
      setCopied(what);
      window.setTimeout(() => setCopied((current) => (current === what ? null : current)), 1600);
      toast.success(t.copied(what === 'password' ? t.password : t.signInDetails));
    } catch {
      toast.error(t.copyFailed);
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: t.shareTitle, text: message });
    } catch {
      // Dismissed, or sharing is unavailable: copying still works.
    }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={reason === 'created' ? t.createdTitle(name) : t.resetSheetTitle(name)}
      description={t.showsOnce}
      footer={
        <div className="flex flex-col gap-2.5">
          {canShare ? (
            <Button variant="outline" icon={IosShareIcon} fullWidth onClick={() => void share()}>
              {t.share}
            </Button>
          ) : null}
          <Button fullWidth onClick={onClose}>
            {t.done}
          </Button>
        </div>
      }
    >
      <dl className="flex flex-col gap-3">
        <div className="rounded-[1.125rem] bg-ink-50 p-4">
          <dt className="text-[0.8125rem] font-semibold text-ink-600">{t.email}</dt>
          <dd className="mt-1 break-all text-base font-semibold text-ink-900">{email}</dd>
        </div>
        <div className="flex items-center gap-3 rounded-[1.125rem] bg-ink-900 p-4 text-white">
          <div className="min-w-0 flex-1">
            <dt className="text-[0.8125rem] font-semibold text-butter-300">{t.oneTimePassword}</dt>
            <dd className="tabular mt-1 select-all font-mono text-[1.375rem] font-semibold tracking-wider">
              {password}
            </dd>
          </div>
          <button
            type="button"
            onClick={() => void copy(password, 'password')}
            aria-label={t.copyPassword}
            className="press flex size-11 shrink-0 items-center justify-center rounded-full bg-butter-300 text-[1.2rem] text-ink-900 hover:bg-butter-200"
          >
            {copied === 'password' ? (
              <CheckIcon fontSize="inherit" className="animate-pop" />
            ) : (
              <ContentCopyIcon fontSize="inherit" />
            )}
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={ContentCopyIcon}
          className="self-start"
          onClick={() => void copy(message, 'details')}
        >
          {t.copyAll}
        </Button>
      </dl>
    </Sheet>
  );
}
