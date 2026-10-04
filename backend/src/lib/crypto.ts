import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** URL-safe random token (refresh tokens). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison (shared secrets). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const left = Buffer.from(sha256Hex(a), 'hex');
  const right = Buffer.from(sha256Hex(b), 'hex');
  return timingSafeEqual(left, right) && a.length === b.length;
}

// No 0/O, 1/l/I: a generated password is read aloud or copied off a screen.
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789';

/** A one-time password the admin hands over: three groups of four, e.g. "k7mq-x2pf-9tcd" (~70 bits). */
export function readablePassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => READABLE[randomInt(READABLE.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}
