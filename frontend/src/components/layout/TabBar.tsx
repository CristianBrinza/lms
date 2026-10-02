import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigation } from 'react-router';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { setNavDirection } from '@/lib/navDirection';
import { isActivePath, NAV_ITEMS } from './nav';

interface Tile {
  x: number;
  width: number;
}

/**
 * The bottom menu: Rounded icons, each with its name underneath (the learning app). The soft
 * cyan tile (the mood app) glides from the old tab to the new one instead of blinking between
 * them, and the chosen icon darkens with a small pop. Phones and tablets; desktops get SideNav.
 */
export function TabBar() {
  const items = NAV_ITEMS;
  const location = useLocation();
  // While a tab's page loads, it already shows as chosen: the tap answers at once.
  const pending = useNavigation().location;
  const pathname = (pending ?? location).pathname;
  const activeIndex = items.findIndex((item) => isActivePath(pathname, item));
  const listRef = useRef<HTMLUListElement>(null);
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
  const [tile, setTile] = useState<Tile | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex < 0) {
      setTile(null);
      return;
    }
    const measure = () => {
      const link = list.querySelectorAll<HTMLElement>('[data-tab]')[activeIndex];
      if (!link) return;
      // The link sits in its own positioned <li>: its offsetLeft counts from there, so add the li's.
      const slot = link.parentElement as HTMLElement;
      const next = { x: slot.offsetLeft + link.offsetLeft, width: link.offsetWidth };
      setTile((current) => (current && current.x === next.x && current.width === next.width ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeIndex]);

  // No glide on first paint: the tile appears in place; later changes animate.
  useLayoutEffect(() => {
    if (tile && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [tile, animate]);

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-white px-5 pb-[max(0.5rem,var(--safe-bottom))] pt-2 shadow-[0_-1px_0_rgb(42_43_102/0.07),0_-14px_32px_-20px_rgb(42_43_102/0.4)] [view-transition-name:tabbar] lg:hidden"
    >
      <ul ref={listRef} className="relative mx-auto flex max-w-md items-center justify-between">
        {tile ? (
          <li
            aria-hidden="true"
            className={cx('pointer-events-none absolute left-0 top-0 h-14 rounded-[0.875rem] bg-cyan-100', animate && 'transition-[translate,width] duration-[380ms] ease-(--ease-lift)')}
            style={{ translate: `${tile.x}px 0`, width: tile.width }}
          />
        ) : null}
        {items.map((item, index) => {
          const active = index === activeIndex;
          const Icon = item.icon;
          return (
            <li key={item.to} className="relative flex flex-1 justify-center">
              <Link
                to={item.to}
                viewTransition
                data-tab=""
                onClick={() => {
                  if (!active) haptic('tap');
                  setNavDirection(activeIndex, index);
                }}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'press flex h-14 w-[4.75rem] flex-col items-center justify-center gap-1 rounded-[0.875rem] transition-colors duration-200',
                  active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900',
                )}
              >
                <Icon key={active ? 'on' : 'off'} fontSize="inherit" className={cx('text-[1.5rem]', active && animate && 'animate-pop')} />
                <span className={cx('text-[0.75rem] leading-none', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
