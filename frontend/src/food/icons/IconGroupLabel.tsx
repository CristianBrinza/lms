import type { ReactNode } from 'react';

/** A small heading across an icon picker's grid ("Your icons", "Built in"). */
export function IconGroupLabel({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="col-span-full px-1 pt-1 text-[0.75rem] font-semibold text-ink-600"
    >
      {children}
    </span>
  );
}
