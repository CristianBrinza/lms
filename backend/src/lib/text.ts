export function truncate(input: string | null | undefined, max: number): string {
  if (!input) return '';
  return input.length > max ? input.slice(0, max) : input;
}

/** Keeps only the network part of an IP for session metadata (privacy by default). */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return '';
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}::`;
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : '';
}
