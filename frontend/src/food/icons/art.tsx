import type { ReactNode } from 'react';
import { BLUE, GREEN, GREY, INK, LAV_D, PINK, PINK_L, RED, TAN, WHITE, YELLOW } from './palette';
import { C, P, R } from './shapes';

import { FOOD_ICON_KEYS as KEYS } from './registry';

/**
 * The food icons are SVG files in ./svg (see registry.ts), drawn by <Icon>. What stays here is
 * the larger artwork for the four Food section cards. The picker list is re-exported for the pages
 * that import it from here.
 */
export const FOOD_ICON_KEYS: readonly string[] = [...KEYS];

/**
 * The four Food sections, drawn larger (64×64) for their cards: the fridge, the recipe book, the
 * trolley and the calendar.
 */
export const SCENE_ART: Record<'kitchen' | 'recipes' | 'shopping' | 'plan', ReactNode> = {
  kitchen: (
    <>
      <R x={14} y={5} w={36} h={53} r={7} f={WHITE} sw={2.6} />
      <path d="M14 25h36" stroke={INK} strokeWidth={2.6} />
      <path d="M21 12v7M21 31v12" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
      <R x={33} y={30} w={11} h={13} r={1.5} f={YELLOW} sw={2} />
      <path d="M35.5 34h6M35.5 38h4" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <C x={40} y={14} r={3.2} f={PINK} w={2} />
      <C x={31} y={16} r={2.4} f={BLUE} w={2} />
      <path d="M19 58v3M45 58v3" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
  recipes: (
    <>
      <P f={WHITE} d="M12 10c0-2.2 1.8-4 4-4h36v48H16c-2.2 0-4 1.8-4 4z" w={2.6} />
      <P f={PINK_L} d="M12 58V10c0-2.2 1.8-4 4-4h3v48h-3c-2.2 0-4 1.8-4 4z" w={2.6} />
      <P f={WHITE} d="M12 58c0-2.2 1.8-4 4-4h36v6H16c-2.2 0-4-.9-4-2z" w={2.6} />
      <path
        d="M44 6v14l3.5-3 3.5 3V6"
        fill={RED}
        stroke={INK}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <path
        d="M27 24v15M24 24v5a3 3 0 006 0v-5M38.5 24c-2.5 0-4 3-4 6.5s1.5 4.5 4 4.5V24zM38.5 35v4"
        fill="none"
        stroke={INK}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  shopping: (
    <>
      <C x={22} y={34} r={6} f={RED} w={2.2} />
      <P f={TAN} d="M30 30c0-4 3-7 7-7s7 3 7 7z" w={2.2} />
      <P f={GREEN} d="M35 21.5l2-7h4l-1 7" w={2.2} />
      <P f={WHITE} d="M8 15h7l5 26h28l5-19H17.4" w={2.6} />
      <P d="M19 31h31.5" w={2} />
      <C x={23} y={50} r={4} f={WHITE} w={2.6} />
      <C x={44} y={50} r={4} f={WHITE} w={2.6} />
      <path
        d="M20 41l-1.5 4.5h31"
        fill="none"
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  plan: (
    <>
      <R x={8} y={12} w={48} h={44} r={7} f={WHITE} sw={2.6} />
      <path d="M8 24h48" stroke={INK} strokeWidth={2.6} />
      <path d="M8.2 19c0-3.9 3-7 6.8-7h34c3.8 0 6.8 3.1 6.8 7v5H8.2z" fill={LAV_D} />
      <path d="M8 24h48M15 12h34" stroke={INK} strokeWidth={2.6} />
      <R x={8} y={12} w={48} h={44} r={7} sw={2.6} />
      <path d="M20 8v8M44 8v8" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
      {[
        [16, 32],
        [26, 32],
        [36, 32],
        [46, 32],
        [16, 42],
        [26, 42],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x! - 2.5}
          y={y! - 2.5}
          width={5}
          height={5}
          rx={1.5}
          fill={GREY}
        />
      ))}
      <C x={40} y={44} r={7} f={YELLOW} w={2.2} />
      <path
        d="M36.8 44.2l2.2 2.3 4.2-4.6"
        fill="none"
        stroke={INK}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};
