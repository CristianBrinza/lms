/** A path inside this app to return to after signing in ("/areas/food"), never another site. */
export function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (/^\/(login|welcome)?(\?|$)/.test(value)) return null;
  return value;
}
