import { describe, expect, it } from 'vitest';
import { safeNextPath } from './nextPath';

describe('safeNextPath (where signing in leads back to)', () => {
  it('keeps paths inside the app', () => {
    expect(safeNextPath('/admin/users')).toBe('/admin/users');
    expect(safeNextPath('/settings?tab=devices')).toBe('/settings?tab=devices');
  });

  it('never leads to another site or back to sign-in', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath('/welcome')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
