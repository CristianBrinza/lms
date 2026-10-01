import {
  HomeIcon,
  HomeOutlinedIcon,
  PersonIcon,
  PersonOutlinedIcon,
  SettingsIcon,
  SettingsOutlinedIcon,
  UtilitiesIcon,
  UtilitiesOutlinedIcon,
  type IconComponent,
} from '@/components/ui/icons';

export interface NavItem {
  to: string;
  label: string;
  /** Filled when chosen, outlined otherwise (the mood app's bottom menu). */
  icon: IconComponent;
  idleIcon: IconComponent;
  /** Other paths that count as this place (People lives under Settings). */
  alsoActive?: RegExp;
}

/**
 * The bottom menu and the desktop rail. Four places today; the bar spreads up to five evenly,
 * so a new place is one more entry here.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/home', label: 'Home', icon: HomeIcon, idleIcon: HomeOutlinedIcon },
  { to: '/utilities', label: 'Utilities', icon: UtilitiesIcon, idleIcon: UtilitiesOutlinedIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, idleIcon: SettingsOutlinedIcon, alsoActive: /^\/admin(\/|$)/ },
  { to: '/profile', label: 'Profile', icon: PersonIcon, idleIcon: PersonOutlinedIcon },
];

export const isActivePath = (pathname: string, item: NavItem) =>
  pathname === item.to || pathname.startsWith(`${item.to}/`) || Boolean(item.alsoActive?.test(pathname));
