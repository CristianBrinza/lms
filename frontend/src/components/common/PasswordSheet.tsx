import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth, useUser } from '@/app/auth';
import { Button, PasswordField, Sheet, toast } from '@/components/ui';
import { LockIcon } from '@/components/ui/icons';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { meApi } from '@/services/api/endpoints';
import { uiT } from '../i18n';
import { MatchMark, PasswordStrength } from './PasswordStrength';

/** Change your password, from Profile or Settings. Other devices sign out; this one stays. */
export function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={uiT().password.title}
      description={uiT().password.description}
    >
      {open ? <PasswordForm onDone={onClose} /> : null}
    </Sheet>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [shake, setShake] = useState(0);
  const save = useMutation({
    mutationFn: () => meApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: (updated) => {
      setUser(updated);
      haptic('success');
      toast.success(uiT().password.changed, { description: uiT().password.changedDetail });
      onDone();
    },
    onError: () => {
      haptic('error');
      setShake((n) => n + 1);
    },
  });
  const fields = fieldErrors(save.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (next !== repeat) {
      haptic('error');
      setShake((n) => n + 1);
      return;
    }
    save.mutate();
  };
  return (
    <form
      key={shake}
      onSubmit={submit}
      noValidate
      className={`flex flex-col gap-4 ${shake ? 'animate-shake' : ''}`}
    >
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={user.email}
        readOnly
        hidden
      />
      <PasswordField
        label={uiT().password.current}
        icon={LockIcon}
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={fields.currentPassword}
        autoFocus
      />
      <div className="flex flex-col gap-2">
        <PasswordField
          label={uiT().password.next}
          icon={LockIcon}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={fields.newPassword}
          hint={uiT().password.nextHint}
        />
        <PasswordStrength password={next} />
      </div>
      <div className="flex flex-col gap-2">
        <PasswordField
          label={uiT().password.repeat}
          icon={LockIcon}
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
        <MatchMark password={next} repeat={repeat} />
      </div>
      {save.error && !fields.currentPassword && !fields.newPassword ? (
        <p className="animate-rise text-sm font-medium text-danger-600">
          {errorMessage(save.error)}
        </p>
      ) : null}
      <Button
        type="submit"
        fullWidth
        loading={save.isPending}
        disabled={!current || next.length < 10 || next !== repeat}
      >
        {uiT().password.submit}
      </Button>
    </form>
  );
}
