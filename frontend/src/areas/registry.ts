import {
  BasketIcon,
  FoodIcon,
  HouseIcon,
  TrainingIcon,
  type IconComponent,
} from '@/components/ui/icons';

/**
 * The life areas LMS has, shown as tiles on the dashboard: Training, Food, House and Shopping; the grid is built
 * for 10+. An area's own screen comes later: build the page, add its route in app/router.tsx and
 * set `to` here, and its card becomes a link. Until then the card says the area is being built.
 */

/** The tile's colour, from the three references: dark and white first, then the pastels. */
export type AreaTone = 'ink' | 'white' | 'butter' | 'lav' | 'mint' | 'cyan' | 'pink' | 'peach';

export interface Area {
  id: string;
  name: string;
  /** One line on the tile: what lives in this area. */
  summary: string;
  icon: IconComponent;
  tone: AreaTone;
  /** The area's own screen, once it exists (e.g. '/training'). Without it the card is not a link. */
  to?: string;
  /** Spans the whole row (Shopping: everything bought, food and house). */
  wide?: boolean;
}

export const AREAS: readonly Area[] = [
  {
    id: 'training',
    name: 'Training',
    summary: 'Workouts and how they add up, week by week.',
    icon: TrainingIcon,
    tone: 'ink',
    to: '/training',
  },
  {
    id: 'food',
    name: 'Food',
    summary: 'Meals, groceries and what’s for dinner.',
    icon: FoodIcon,
    tone: 'white',
    to: '/food',
  },
  {
    id: 'house',
    name: 'House',
    summary: 'Bathroom, cleaning, paper, pets.',
    icon: HouseIcon,
    tone: 'mint',
    to: '/house',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    summary: 'One list for food and the house, store by store.',
    icon: BasketIcon,
    tone: 'butter',
    to: '/shopping',
    wide: true,
  },
];

/**
 * Each tone's surface, text and round button. The button is butter on dark and white tiles (the
 * yellow app's play buttons), white on butter, ink on the pastels. Text on every tone meets AA.
 */
export const TONES: Record<
  AreaTone,
  { surface: string; text: string; muted: string; chip: string; button: string }
> = {
  ink: {
    surface: 'bg-ink-900 shadow-[var(--shadow-tile)]',
    text: 'text-white',
    muted: 'text-white/70',
    chip: 'bg-white text-ink-900',
    button: 'bg-butter-300 text-ink-900 shadow-[0_8px_16px_-8px_rgb(0_0_0/0.55)]',
  },
  white: {
    surface: 'bg-white shadow-[var(--shadow-tile)]',
    text: 'text-ink-900',
    muted: 'text-ink-600',
    chip: 'bg-butter-100 text-butter-800',
    button: 'bg-butter-300 text-ink-900 shadow-[0_8px_16px_-8px_rgb(110_80_0/0.45)]',
  },
  butter: {
    surface: 'bg-butter-300',
    text: 'text-ink-900',
    muted: 'text-butter-800',
    chip: 'bg-white text-ink-900',
    button: 'bg-white text-ink-900',
  },
  lav: {
    surface: 'bg-lav-200',
    text: 'text-ink-900',
    muted: 'text-lav-800',
    chip: 'bg-white text-ink-900',
    button: 'bg-ink-900 text-white',
  },
  mint: {
    surface: 'bg-mint-200',
    text: 'text-ink-900',
    muted: 'text-mint-800',
    chip: 'bg-white text-ink-900',
    button: 'bg-ink-900 text-white',
  },
  cyan: {
    surface: 'bg-cyan-200',
    text: 'text-ink-900',
    muted: 'text-cyan-800',
    chip: 'bg-white text-ink-900',
    button: 'bg-ink-900 text-white',
  },
  pink: {
    surface: 'bg-pink-200',
    text: 'text-ink-900',
    muted: 'text-pink-800',
    chip: 'bg-white text-ink-900',
    button: 'bg-ink-900 text-white',
  },
  peach: {
    surface: 'bg-peach-200',
    text: 'text-ink-900',
    muted: 'text-peach-800',
    chip: 'bg-white text-ink-900',
    button: 'bg-ink-900 text-white',
  },
};
