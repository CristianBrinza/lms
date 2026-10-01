import { useQuery } from '@tanstack/react-query';
import { useAuth, useUser } from '@/app/auth';
import { AreaGrid } from '@/areas/AreaTile';
import { AREAS } from '@/areas/registry';
import { FeatureCard } from '@/components/common/FeatureCard';
import { InstallCard } from '@/components/common/InstallCard';
import { Screen } from '@/components/layout/Screen';
import { formatDay, partOfDay } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';

/**
 * Home, the three references in one screen: the task app's lavender field and two-tone headline,
 * the mood apps' dark and white tiles for the life areas, and their white sheet pulled up from
 * the bottom with featured cards.
 */
export default function HomePage() {
  const user = useUser();
  const { isAdmin } = useAuth();
  const now = new Date();
  const since = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(user.createdAt));

  return (
    <Screen tone="field" className="flex flex-col" clearTabBar={false}>
      <header className="gutter-x flex items-center gap-3 pt-[calc(var(--safe-top)+1rem)] lg:px-8 lg:pt-7">
        <div className="min-w-0 flex-1">
          <p className="truncate text-h2 font-bold">Hi, {user.name}!</p>
          <p className="truncate text-sm font-medium text-lav-800">{formatDay(now)}</p>
        </div>
      </header>

      <div className="gutter-x mt-7 lg:px-8">
        <h1 className="text-display font-bold lg:text-[3.5rem]">
          <span className="text-lav-800">Good {partOfDay(now)}.</span>
          <br />
          What’s next?
        </h1>
        <section aria-labelledby="areas-title" className="mt-7">
          <h2 id="areas-title" className="sr-only">
            Your areas
          </h2>
          <AreaGrid areas={AREAS} />
        </section>
      </div>

      {/* The mood apps' white sheet, pulled up over the field. */}
      <section
        aria-labelledby="for-you-title"
        className="mt-8 flex-1 rounded-t-[2rem] bg-white px-5 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+1.5rem)] pt-3 shadow-sheet lg:mx-8 lg:mb-8 lg:flex-none lg:rounded-[2rem] lg:p-8 lg:pt-4"
      >
        <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-pill bg-ink-200 lg:hidden" />
        <h2 id="for-you-title" className="mt-5 text-h3 font-bold lg:mt-3">
          For you
        </h2>
        <div className="mt-3.5 grid gap-3 md:grid-cols-2">
          <InstallCard />
          {isAdmin ? <PeopleCard /> : null}
          <FeatureCard to="/profile" tone="white" title="Your profile and password" pills={[user.role === 'admin' ? 'Admin' : 'Member', `Since ${since}`]} />
        </div>
      </section>
    </Screen>
  );
}

/** Admins only: who can sign in, one tap from the console. */
function PeopleCard() {
  const users = useQuery({ queryKey: queryKeys.users(''), queryFn: () => adminApi.users() });
  const active = (users.data ?? []).filter((person) => person.isActive).length;
  const label = users.isPending ? 'Loading…' : `${active} can sign in`;
  return <FeatureCard to="/admin/users" tone="cyan" title="People and access" pills={[label, 'Add a person']} />;
}
