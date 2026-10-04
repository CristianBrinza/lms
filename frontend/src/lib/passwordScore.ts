/** 0 too short · 1 okay · 2 good · 3 strong. Length matters most; mixing kinds of characters helps. */
export function passwordScore(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 10) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) =>
    kind.test(password),
  ).length;
  if (password.length >= 20 || (password.length >= 16 && kinds >= 2)) return 3;
  if (password.length >= 14 || kinds >= 2) return 2;
  return 1;
}
