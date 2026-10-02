import { HomeIcon, PersonIcon, SettingsIcon, UtilitiesIcon, type IconComponent } from '@/components/ui/icons';

export interface NavItem {
  to: string;
  label: string;
  /** A Rounded icon: ink and popping when chosen, grey otherwise. */
  icon: IconComponent;
  /** Other paths that count as this place (People lives under Settings). */
  alsoActive?: RegExp;
}

/**
 * The bottom menu and the desktop rail. Four places today; the bar spreads up to five evenly,
 * so a new place is one more entry here.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  // Life areas open from Home, so Home stays lit inside them.
  { to: '/home', label: 'Home', icon: HomeIcon, alsoActive: /^\/food(\/|$)/ },
  { to: '/utilities', label: 'Utilities', icon: UtilitiesIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, alsoActive: /^\/admin(\/|$)/ },
  { to: '/profile', label: 'Profile', icon: PersonIcon },
];

export const isActivePath = (pathname: string, item: NavItem) =>
  pathname === item.to || pathname.startsWith(`${item.to}/`) || Boolean(item.alsoActive?.test(pathname));
