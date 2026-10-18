import { describe, expect, it } from 'vitest';
import { assistantButtonVisible } from './visibility';

describe('the floating assistant button', () => {
  const base = { isAdmin: true, pathname: '/home', open: false };

  it('shows on signed-in screens for admins', () => {
    expect(assistantButtonVisible(base)).toBe(true);
    expect(assistantButtonVisible({ ...base, pathname: '/food/recipes/12' })).toBe(true);
  });

  it('stays hidden for everyone else, and while the assistant is open', () => {
    expect(assistantButtonVisible({ ...base, isAdmin: false })).toBe(false);
    expect(assistantButtonVisible({ ...base, open: true })).toBe(false);
  });

  it('steps aside on sign-in screens', () => {
    expect(assistantButtonVisible({ ...base, pathname: '/login' })).toBe(false);
    expect(assistantButtonVisible({ ...base, pathname: '/closet/cutout/3' })).toBe(false);
    expect(assistantButtonVisible({ ...base, pathname: '/loginfoo' })).toBe(true);
  });
});
