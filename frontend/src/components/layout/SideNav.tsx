import { Link, useLocation } from 'react-router';
import { useUser } from '@/app/auth';
import { Lockup } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui';
import { cx } from '@/lib/cx';
import { fullName } from '@/lib/format';
import { isActivePath, NAV_ITEMS } from './nav';

/** Desktop navigation: a white rail with the same places as the tab bar. */
export function SideNav() {
  const items = NAV_ITEMS;
  const user = useUser();
  const { pathname } = useLocation();
  return (
    <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col rounded-3xl bg-white p-4 shadow-card [view-transition-name:sidenav] lg:flex">
      <Link to="/home" className="rounded-2xl px-2 py-1.5" aria-label="LMS home">
        <Lockup />
      </Link>
      <nav aria-label="Main" className="mt-8">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActivePath(pathname, item);
            const Icon = active ? item.icon : item.idleIcon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  viewTransition
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'press flex h-12 items-center gap-3 rounded-2xl px-4 text-[0.9375rem] font-semibold',
                    active ? 'bg-cyan-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                  )}
                >
                  <Icon fontSize="inherit" className="text-[1.4rem]" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link to="/profile" className="press mt-auto flex items-center gap-3 rounded-2xl p-2 hover:bg-ink-50">
        <Avatar person={user} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink-900">{fullName(user)}</span>
          <span className="block truncate text-xs text-ink-600">{user.email}</span>
        </span>
      </Link>
    </aside>
  );
}
