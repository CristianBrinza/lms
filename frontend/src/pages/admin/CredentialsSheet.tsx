import { Button, Sheet, toast } from '@/components/ui';
import { ContentCopyIcon, IosShareIcon } from '@/components/ui/icons';

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
export function CredentialsSheet({ open, onClose, name, email, password, reason }: CredentialsSheetProps) {
  const url = `${window.location.origin}/login`;
  const message = `Your LMS account is ready.\n\nOpen ${url}\nEmail: ${email}\nOne-time password: ${password}\n\nYou'll choose your own password after signing in. Add LMS to your Home Screen: ${window.location.origin}/app`;

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Couldn’t copy. Select the text and copy it instead.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'LMS sign-in', text: message });
    } catch {
      // Dismissed, or sharing is unavailable: copying still works.
    }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={reason === 'created' ? `${name} can sign in now` : `New password for ${name}`}
      description="This password shows only once. Send it to them now; they’ll replace it at first sign-in."
      footer={
        <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
          {canShare ? (
            <Button variant="tint" size="md" icon={IosShareIcon} onClick={() => void share()}>
              Share sign-in details
            </Button>
          ) : null}
          <Button size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <dl className="flex flex-col gap-3">
        <div className="rounded-2xl bg-lav-50 p-4">
          <dt className="text-sm font-semibold text-lav-800">Email</dt>
          <dd className="mt-1 break-all text-base font-semibold text-ink-900">{email}</dd>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-ink-900 p-4 text-white">
          <div className="min-w-0 flex-1">
            <dt className="text-sm font-semibold text-lav-200">One-time password</dt>
            <dd className="tabular mt-1 select-all font-mono text-[1.375rem] font-semibold tracking-wider">{password}</dd>
          </div>
          <button
            type="button"
            onClick={() => void copy(password, 'Password')}
            aria-label="Copy password"
            className="press flex size-11 shrink-0 items-center justify-center rounded-full bg-white/12 text-[1.2rem] hover:bg-white/20"
          >
            <ContentCopyIcon fontSize="inherit" />
          </button>
        </div>
        <Button variant="tint" size="sm" icon={ContentCopyIcon} className="self-start" onClick={() => void copy(message, 'Sign-in details')}>
          Copy all sign-in details
        </Button>
      </dl>
    </Sheet>
  );
}
