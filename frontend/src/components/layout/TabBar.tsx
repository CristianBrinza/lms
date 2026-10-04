import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigation } from 'react-router';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { setNavDirection } from '@/lib/navDirection';
import { isActivePath, NAV_ITEMS } from './nav';

/**
 * The bottom menu: Rounded icons, each with its name underneath, every tab the full width of its
 * share of the bar so a thumb can't miss. A soft cyan pill sits behind the chosen icon
 * on the chosen tab; the icon darkens with a small pop. Phones only; tablets and desktops get SideNav.
 */
export function TabBar() {
  const items = NAV_ITEMS;
  const location = useLocation();
  // While a tab's page loads, it already shows as chosen: the tap answers at once.
  const pending = useNavigation().location;
  const pathname = (pending ?? location).pathname;
  const activeIndex = items.findIndex((item) => isActivePath(pathname, item));
  const navRef = useRef<HTMLElement>(null);

  // Its exact height, for bars that dock on top of it (e.g. a shopping cart).
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--tabbar-real', `${nav.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--tabbar-real');
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-white px-1 pb-[max(0.25rem,var(--safe-bottom))] pt-1 shadow-[0_-1px_0_rgb(42_43_102/0.08),0_-10px_24px_-18px_rgb(42_43_102/0.4)] [view-transition-name:tabbar] md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item, index) => {
          const active = index === activeIndex;
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex flex-1">
              <Link
                to={item.to}
                viewTransition
                onClick={() => {
                  if (!active) haptic('tap');
                  setNavDirection(activeIndex, index);
                }}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'press flex h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors duration-200',
                  active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900',
                )}
              >
                {/* The pill hugs the icon only, so it can never run into the label. */}
                <span
                  className={cx(
                    'grid h-7 w-14 place-items-center rounded-full transition-[background-color,transform] duration-300 ease-(--ease-lift)',
                    active ? 'scale-100 bg-cyan-100' : 'scale-90 bg-transparent',
                  )}
                >
                  <Icon
                    key={active ? 'on' : 'off'}
                    fontSize="inherit"
                    className={cx('text-[1.375rem]', active && 'animate-pop')}
                  />
                </span>
                <span
                  className={cx(
                    'text-[0.75rem] leading-none',
                    active ? 'font-bold' : 'font-medium',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
