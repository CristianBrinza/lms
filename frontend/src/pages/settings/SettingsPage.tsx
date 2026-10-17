import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/app/auth';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { PasswordSheet } from '@/components/common/PasswordSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import {
  Badge,
  Button,
  ListGroup,
  ListRow,
  ListRowButton,
  ListRowLink,
  Sheet,
  Skeleton,
  toast,
} from '@/components/ui';
import {
  AdminIcon,
  CheckIcon,
  CloseIcon,
  DevicesIcon,
  FavoriteIcon,
  HouseIcon,
  InstallIcon,
  LanguageIcon,
  LaptopIcon,
  LockIcon,
  PersonIcon,
  LogoutIcon,
  PhoneIphoneIcon,
  SparkleIcon,
  StorageIcon,
  SyncIcon,
} from '@/components/ui/icons';
import { NotificationsIcon } from './icons';
import { settingsT } from './i18n';
import { PeopleLink } from './PeopleLink';
import { BUILD } from '@/build-info';
import { LOCALE_NAMES, LOCALES, useLocale } from '@/i18n';
import { useChangeLocale } from '@/i18n/I18nRoot';
import { newBuildOnServer } from '@/lib/appUpdate';
import { errorMessage } from '@/lib/errors';
import { describeDevice, formatAgo, formatDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { currentPlatform } from '@/lib/platform';
import { meApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';
import type { DeviceSession } from '@/types/api';

/** The app on this device, the devices signed in to this account, admin tools and sign-out. */
export default function SettingsPage() {
  const t = settingsT();
  const { isAdmin, logout } = useAuth();
  const locale = useLocale();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const standalone = currentPlatform().standalone;

  const checkForUpdate = async () => {
    setChecking(true);
    try {
      if (await newBuildOnServer()) {
        toast.info(t.updating, { description: t.staySignedIn });
        const registration = await navigator.serviceWorker?.getRegistration();
        await registration?.update().catch(() => undefined);
        // The update prompt takes over once the new version has downloaded; without a service
        // worker (development, private mode) a reload is the update.
        if (!registration) window.location.reload();
      } else {
        toast.success(t.upToDate);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen tone="white">
      <PageHeader title={t.title} />
      <div className="gutter-x mt-7 grid max-w-2xl gap-7 lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-8 lg:px-8 xl:max-w-6xl">
        <div className="flex flex-col gap-7">
          <ListGroup title={t.thisDevice}>
            {standalone ? (
              <ListRow
                icon={InstallIcon}
                label={t.lmsApp}
                detail={t.lmsAppDetail}
                trailing={<Badge tone="mint">{t.installed}</Badge>}
              />
            ) : (
              <ListRowLink
                to="/app"
                icon={InstallIcon}
                label={t.addToHome}
                detail={t.addToHomeDetail}
              />
            )}
            <ListRowButton
              icon={SyncIcon}
              label={t.checkUpdates}
              detail={t.version(BUILD.version)}
              onClick={() => void checkForUpdate()}
              disabled={checking}
            />
          </ListGroup>

          <ListGroup title={t.yourAccount}>
            <ListRowButton
              icon={LanguageIcon}
              label={t.language}
              detail={LOCALE_NAMES[locale]}
              onClick={() => setLanguageOpen(true)}
            />
            <ListRowButton
              icon={LockIcon}
              label={t.changePassword}
              detail={t.changePasswordDetail}
              onClick={() => setPasswordOpen(true)}
            />
            <ListRowLink
              to="/profile"
              icon={PersonIcon}
              label={t.profile}
              detail={t.profileDetail}
            />
          </ListGroup>

          <ListGroup title={t.kitchen}>
            <ListRowLink
              to="/settings/reminders"
              icon={NotificationsIcon}
              label={t.reminders}
              detail={t.remindersDetail}
            />
            <PeopleLink />
            <ListRowLink
              to="/training/health#connect"
              icon={FavoriteIcon}
              label={t.health}
              detail={t.healthDetail}
            />
            <ListRowLink
              to="/settings/ai"
              icon={SparkleIcon}
              label={t.claude}
              detail={t.claudeDetail}
            />
          </ListGroup>

          {isAdmin ? (
            <ListGroup title={t.admin}>
              <ListRowLink
                to="/admin/users"
                icon={AdminIcon}
                label={t.peopleAccess}
                detail={t.peopleAccessDetail}
              />
              <ListRowLink
                to="/admin/households"
                icon={HouseIcon}
                label={t.households}
                detail={t.householdsDetail}
              />
              <ListRowLink
                to="/admin/backups"
                icon={StorageIcon}
                label={t.backups}
                detail={t.backupsDetail}
              />
            </ListGroup>
          ) : null}
        </div>

        <div className="flex flex-col gap-7">
          <Devices />
          <ListGroup>
            <ListRowButton
              icon={LogoutIcon}
              label={t.signOut}
              detail={t.signOutDetail}
              onClick={() => setConfirmSignOut(true)}
            />
          </ListGroup>
        </div>
      </div>

      <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
      <PasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <ConfirmSheet
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={() => void logout()}
        title={t.signOutTitle}
        description={t.signOutLine}
        confirmLabel={t.signOut}
        tone="danger"
      />
    </Screen>
  );
}

/**
 * The language, for the person: each one in its own words, the chosen one ticked. Switching
 * redraws the app at once and is saved on the account, so other devices follow.
 */
function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = settingsT();
  const locale = useLocale();
  const changeLocale = useChangeLocale();
  return (
    <Sheet open={open} onClose={onClose} title={t.language} description={t.languageDetail}>
      <div
        role="radiogroup"
        aria-label={t.language}
        className="divide-y divide-ink-100 overflow-hidden rounded-3xl bg-white ring-1 ring-inset ring-ink-100"
      >
        {LOCALES.map((option) => {
          const active = option === locale;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              lang={option}
              onClick={() => {
                haptic('tap');
                onClose();
                if (!active) changeLocale(option);
              }}
              className="press flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-ink-50 active:bg-ink-100"
            >
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink-900">
                {LOCALE_NAMES[option]}
              </span>
              {active ? (
                <CheckIcon fontSize="inherit" className="shrink-0 text-[1.4rem] text-ink-900" />
              ) : null}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Rows shown before "Show all": this device and the four most recent others. */
const DEVICES_SHOWN = 5;

function Devices() {
  const t = settingsT();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: queryKeys.sessions, queryFn: meApi.sessions });
  const [confirmOthers, setConfirmOthers] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions });

  const end = useMutation({
    mutationFn: (id: string) => meApi.endSession(id),
    onSuccess: () => {
      toast.success(t.deviceSignedOut);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const others = useMutation({
    mutationFn: meApi.signOutOthers,
    onSuccess: () => {
      setConfirmOthers(false);
      toast.success(t.othersSignedOut);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const [showAll, setShowAll] = useState(false);
  // This device first, then the rest as the API orders them (most recent first).
  const list = [...(sessions.data ?? [])].sort((a, b) => Number(b.current) - Number(a.current));
  const hasOthers = list.some((session) => !session.current);
  const shown = showAll ? list : list.slice(0, DEVICES_SHOWN);

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
        <h2 className="text-h3 font-bold text-ink-900">{t.signedInOn}</h2>
        {hasOthers ? (
          <Button variant="soft" size="sm" className="-my-2" onClick={() => setConfirmOthers(true)}>
            {t.signOutOthers}
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
          <ListRow
            icon={DevicesIcon}
            label={t.devicesFailed}
            detail={errorMessage(sessions.error)}
          />
        ) : (
          <>
            {shown.map((session) => (
              <DeviceRow
                key={session.id}
                session={session}
                onEnd={() => end.mutate(session.id)}
                ending={end.isPending && end.variables === session.id}
              />
            ))}
            {list.length > DEVICES_SHOWN ? (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className="flex min-h-12 w-full items-center justify-center text-sm font-semibold text-lav-700 transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lav-600 active:bg-ink-100"
              >
                {showAll ? t.showFewer : t.showAll(list.length)}
              </button>
            ) : null}
          </>
        )}
      </div>
      <ConfirmSheet
        open={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        onConfirm={() => others.mutate()}
        loading={others.isPending}
        title={t.othersTitle}
        description={t.othersLine}
        confirmLabel={t.othersConfirm}
      />
    </section>
  );
}

function DeviceRow({
  session,
  onEnd,
  ending,
}: {
  session: DeviceSession;
  onEnd: () => void;
  ending: boolean;
}) {
  const t = settingsT();
  const name = describeDevice(session.userAgent);
  const mobile = /iPhone|iPad|Android/.test(name);
  return (
    <ListRow
      icon={mobile ? PhoneIphoneIcon : LaptopIcon}
      label={name}
      detail={
        session.current
          ? t.signedInAt(formatDate(session.createdAt))
          : t.lastUsed(formatAgo(session.lastUsedAt).toLowerCase())
      }
      trailing={
        session.current ? (
          <Badge tone="ink">{t.thisDeviceBadge}</Badge>
        ) : (
          <button
            type="button"
            onClick={onEnd}
            disabled={ending}
            aria-label={t.signOutDevice(name)}
            title={t.signOutThisDevice}
            className="press flex size-11 shrink-0 items-center justify-center rounded-full text-[1.25rem] text-ink-500 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-40"
          >
            <CloseIcon fontSize="inherit" />
          </button>
        )
      }
    />
  );
}
