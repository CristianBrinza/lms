import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/app/auth';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { PasswordSheet } from '@/components/common/PasswordSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Badge, Button, ListGroup, ListRow, ListRowButton, ListRowLink, Skeleton, toast } from '@/components/ui';
import { AdminIcon, CloseIcon, DevicesIcon, InstallIcon, LaptopIcon, LockIcon, LogoutIcon, PersonOutlinedIcon, PhoneIphoneIcon, SyncIcon } from '@/components/ui/icons';
import { BUILD } from '@/build-info';
import { newBuildOnServer } from '@/lib/appUpdate';
import { errorMessage } from '@/lib/errors';
import { describeDevice, formatAgo, formatDate } from '@/lib/format';
import { currentPlatform } from '@/lib/platform';
import { meApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';
import type { DeviceSession } from '@/types/api';

/** The app on this device, the devices signed in to this account, admin tools and sign-out. */
export default function SettingsPage() {
  const { isAdmin, logout } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const standalone = currentPlatform().standalone;

  const checkForUpdate = async () => {
    setChecking(true);
    try {
      if (await newBuildOnServer()) {
        toast.info('Updating LMS…', { description: 'You stay signed in.' });
        const registration = await navigator.serviceWorker?.getRegistration();
        await registration?.update().catch(() => undefined);
        // The update prompt takes over once the new version has downloaded; without a service
        // worker (development, private mode) a reload is the update.
        if (!registration) window.location.reload();
      } else {
        toast.success('LMS is up to date');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen tone="white">
      <PageHeader title="Settings" />
      <div className="gutter-x mt-7 lg:px-8 flex max-w-2xl flex-col gap-7">
        <ListGroup title="This device">
          {standalone ? (
            <ListRow icon={InstallIcon} label="LMS app" detail="Installed and running from your Home Screen" trailing={<Badge tone="mint">Installed</Badge>} />
          ) : (
            <ListRowLink to="/app" icon={InstallIcon} label="Add to Home Screen" detail="Full screen, stays signed in, updates by itself" />
          )}
          <ListRowButton
            icon={SyncIcon}
            label="Check for updates"
            detail={`Version ${BUILD.version}`}
            onClick={() => void checkForUpdate()}
            disabled={checking}
          />
        </ListGroup>

        <ListGroup title="Your account">
          <ListRowButton icon={LockIcon} label="Change password" detail="Other devices sign out; this one stays" onClick={() => setPasswordOpen(true)} />
          <ListRowLink to="/profile" icon={PersonOutlinedIcon} label="Profile" detail="Your name and surname" />
        </ListGroup>

        <Devices />

        {isAdmin ? (
          <ListGroup title="Admin">
            <ListRowLink to="/admin/users" icon={AdminIcon} label="People and access" detail="Create accounts, reset passwords, switch people off" />
          </ListGroup>
        ) : null}

        <ListGroup>
          <ListRowButton icon={LogoutIcon} label="Sign out" detail="On this device only" onClick={() => setConfirmSignOut(true)} />
        </ListGroup>
      </div>

      <PasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <ConfirmSheet
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={() => void logout()}
        title="Sign out of LMS?"
        description="You’ll need your email and password to come back on this device."
        confirmLabel="Sign out"
        tone="danger"
      />
    </Screen>
  );
}

function Devices() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: queryKeys.sessions, queryFn: meApi.sessions });
  const [confirmOthers, setConfirmOthers] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions });

  const end = useMutation({
    mutationFn: (id: string) => meApi.endSession(id),
    onSuccess: () => {
      toast.success('That device is signed out');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const others = useMutation({
    mutationFn: meApi.signOutOthers,
    onSuccess: () => {
      setConfirmOthers(false);
      toast.success('Signed out everywhere else');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const list = sessions.data ?? [];
  const hasOthers = list.some((session) => !session.current);

  return (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
        <h2 className="text-h3 font-bold text-ink-900">Signed in on</h2>
        {hasOthers ? (
          <Button variant="soft" size="sm" onClick={() => setConfirmOthers(true)}>
            Sign out others
          </Button>
        ) : null}
      </div>
      <div className="divide-y divide-ink-100 overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
        {sessions.isPending ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : sessions.isError ? (
          <ListRow icon={DevicesIcon} label="Couldn’t load your devices" detail={errorMessage(sessions.error)} />
        ) : (
          list.map((session) => <DeviceRow key={session.id} session={session} onEnd={() => end.mutate(session.id)} ending={end.isPending && end.variables === session.id} />)
        )}
      </div>
      <ConfirmSheet
        open={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        onConfirm={() => others.mutate()}
        loading={others.isPending}
        title="Sign out every other device?"
        description="This device stays signed in. The others will need your password again."
        confirmLabel="Sign them out"
      />
    </section>
  );
}

function DeviceRow({ session, onEnd, ending }: { session: DeviceSession; onEnd: () => void; ending: boolean }) {
  const name = describeDevice(session.userAgent);
  const mobile = /iPhone|iPad|Android/.test(name);
  return (
    <ListRow
      icon={mobile ? PhoneIphoneIcon : LaptopIcon}
      label={name}
      detail={session.current ? `Signed in ${formatDate(session.createdAt)}` : `Last used ${formatAgo(session.lastUsedAt).toLowerCase()}`}
      trailing={
        session.current ? (
          <Badge tone="ink">This device</Badge>
        ) : (
          <button
            type="button"
            onClick={onEnd}
            disabled={ending}
            aria-label={`Sign out ${name}`}
            title="Sign out this device"
            className="press flex size-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] text-ink-500 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-40"
          >
            <CloseIcon fontSize="inherit" />
          </button>
        )
      }
    />
  );
}
