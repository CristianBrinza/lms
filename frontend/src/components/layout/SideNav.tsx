import { Link, useLocation } from 'react-router';
import { useUser } from '@/app/auth';
import { Lockup, LogoTile } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui';
import { cx } from '@/lib/cx';
import { fullName } from '@/lib/format';
import { isActivePath, NAV_ITEMS } from './nav';

/**
 * Navigation beside the page, from tablets up. On an iPad (and narrow windows) a rail: each place
 * an icon in its pill with the name underneath, like the bottom menu turned on its side, so the
 * page keeps the width. From desktop widths, the full white menu with names beside the icons.
 */
export function SideNav() {
  const items = NAV_ITEMS;
  const user = useUser();
  const { pathname } = useLocation();
  return (
    <aside
      className={cx(
        'sticky top-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col items-stretch rounded-3xl bg-white shadow-card [view-transition-name:sidenav] md:flex',
        'w-[5.5rem] px-2 pb-3 pt-[max(1rem,var(--safe-top))] lg:top-4 lg:h-[calc(100dvh-2rem)] lg:w-64 lg:p-4',
      )}
    >
      <Link to="/home" className="mx-auto rounded-2xl px-2 py-1.5 lg:mx-0" aria-label="LMS home">
        <span className="lg:hidden">
          <LogoTile className="size-10" label={null} />
        </span>
        <span className="hidden lg:block">
          <Lockup />
        </span>
      </Link>
      <nav aria-label="Main" className="mt-6 lg:mt-8">
        <ul className="flex flex-col gap-1.5 lg:gap-1">
          {items.map((item) => {
            const active = isActivePath(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  viewTransition
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'press group flex flex-col items-center gap-1 rounded-2xl py-2 text-[0.75rem] font-semibold',
                    'lg:h-12 lg:flex-row lg:gap-3 lg:px-4 lg:py-0 lg:text-[0.9375rem]',
                    active ? 'text-ink-900 lg:bg-cyan-100' : 'text-ink-500 hover:text-ink-900 lg:text-ink-600 lg:hover:bg-ink-50',
                  )}
                >
                  {/* On the rail the pill hugs the icon, as in the bottom menu; the full menu fills the row instead. */}
                  <span
                    className={cx(
                      'grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 lg:h-auto lg:w-auto lg:bg-transparent',
                      active ? 'bg-cyan-100' : 'group-hover:bg-ink-50',
                    )}
                  >
                    <Icon fontSize="inherit" className="text-[1.4rem]" />
                  </span>
                  <span className={cx('leading-none lg:leading-normal', active && 'font-bold')}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link
        to="/profile"
        aria-label={`Profile: ${fullName(user)}`}
        className="press mx-auto mt-auto flex items-center gap-3 rounded-2xl p-1.5 hover:bg-ink-50 lg:mx-0 lg:p-2"
      >
        <Avatar person={user} size="md" />
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm font-bold text-ink-900">{fullName(user)}</span>
          <span className="block truncate text-xs text-ink-600">{user.email}</span>
        </span>
      </Link>
    </aside>
  );
}
