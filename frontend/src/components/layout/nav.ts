import {
  HomeIcon,
  PersonIcon,
  SettingsIcon,
  InsightsIcon,
  type IconComponent,
} from '@/components/ui/icons';
import { uiT } from '../i18n';

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
 * so a new place is one more entry here. Made on each render, in the current language.
 */
export function navItems(): readonly NavItem[] {
  const t = uiT().nav;
  return [
    // Life areas open from Home, so Home stays lit inside them.
    {
      to: '/home',
      label: t.home,
      icon: HomeIcon,
      alsoActive: /^\/(food|training|house|travel|shopping|drinks|closet|medication)(\/|$)/,
    },
    { to: '/statistics', label: t.statistics, icon: InsightsIcon },
    { to: '/settings', label: t.settings, icon: SettingsIcon, alsoActive: /^\/admin(\/|$)/ },
    { to: '/profile', label: t.profile, icon: PersonIcon },
  ];
}

export const isActivePath = (pathname: string, item: NavItem) =>
  pathname === item.to ||
  pathname.startsWith(`${item.to}/`) ||
  Boolean(item.alsoActive?.test(pathname));
