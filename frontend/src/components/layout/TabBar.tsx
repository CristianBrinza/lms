import { Link, useLocation, useNavigation } from 'react-router';
import { cx } from '@/lib/cx';
import { setNavDirection } from '@/lib/navDirection';
import { isActivePath, NAV_ITEMS } from './nav';

/**
 * The bottom menu: a white bar of outlined icons, each with its name underneath (the learning
 * app); the chosen one fills and sits in a soft cyan rounded tile (the mood app). Phones and
 * tablets; desktops get SideNav.
 */
export function TabBar() {
  const items = NAV_ITEMS;
  const location = useLocation();
  // While a tab's page loads, it already shows as chosen: the tap answers at once.
  const pending = useNavigation().location;
  const pathname = (pending ?? location).pathname;
  const activeIndex = items.findIndex((item) => isActivePath(pathname, item));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-white px-5 shadow-[0_-1px_0_rgb(42_43_102/0.07),0_-14px_32px_-20px_rgb(42_43_102/0.4)] pb-[max(0.5rem,var(--safe-bottom))] pt-2 [view-transition-name:tabbar] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-center justify-between">
        {items.map((item, index) => {
          const active = index === activeIndex;
          const Icon = active ? item.icon : item.idleIcon;
          return (
            <li key={item.to} className="flex flex-1 justify-center">
              <Link
                to={item.to}
                viewTransition
                onClick={() => setNavDirection(activeIndex, index)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'press flex h-14 w-[4.75rem] flex-col items-center justify-center gap-1 rounded-[0.875rem] transition-colors duration-200',
                  active ? 'bg-cyan-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                <Icon fontSize="inherit" className="text-[1.5rem]" />
                <span className={cx('text-[0.75rem] leading-none', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
