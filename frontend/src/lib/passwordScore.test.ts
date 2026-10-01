import { describe, expect, it } from 'vitest';
import { passwordScore } from './passwordScore';

describe('passwordScore (the strength meter)', () => {
  it('calls anything under 10 characters too short', () => {
    expect(passwordScore('Ab1!')).toBe(0);
    expect(passwordScore('abcdefghi')).toBe(0);
  });
  it('rewards length first, then mixing kinds of characters', () => {
    expect(passwordScore('abcdefghij')).toBe(1);
    expect(passwordScore('abcdefghi1')).toBe(2);
    expect(passwordScore('correct horse batt')).toBe(3);
    expect(passwordScore('a long sentence for my family app')).toBe(3);
  });
});
