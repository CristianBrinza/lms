/** Screens where the floating assistant button stays out of the way (sign-in, full-screen editors). */
const HIDDEN = /^\/(login|sign-in|signin|forgot|reset|welcome|closet\/cutout)(\/|$)/;

/**
 * Whether the floating button shows: for admins (Claude runs on the server, so for now only they
 * may use it), on every signed-in screen, but not while the assistant itself is open.
 */
export function assistantButtonVisible(input: {
  isAdmin: boolean;
  pathname: string;
  open: boolean;
}): boolean {
  if (!input.isAdmin || input.open) return false;
  return !HIDDEN.test(input.pathname);
}
