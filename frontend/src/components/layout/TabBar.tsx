import { Link, useLocation, useNavigation } from 'react-router';
import { cx } from '@/lib/cx';
import { setNavDirection } from '@/lib/navDirection';
import { isActivePath, NAV_ITEMS } from './nav';

/**
 * The mood app's bottom menu: a white bar of outlined icons; the chosen one fills and sits in a
 * soft cyan rounded tile with its label underneath. Phones and tablets; desktops get SideNav.
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white px-5 pb-[max(0.5rem,var(--safe-bottom))] pt-2 [view-transition-name:tabbar] lg:hidden"
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
                aria-label={item.label}
                className={cx(
                  'press flex h-14 w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-[0.875rem] transition-colors duration-200',
                  active ? 'bg-cyan-100 text-ink-900' : 'text-ink-800 hover:bg-ink-50',
                )}
              >
                <Icon fontSize="inherit" className="text-[1.6rem]" />
                {active ? (
                  <span aria-hidden="true" className="animate-fade-in text-[0.75rem] font-semibold leading-none">
                    {item.label}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
