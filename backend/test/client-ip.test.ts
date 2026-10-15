import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { clientIpResolver, proxyTrust } from '../src/lib/client-ip';

const TUNNEL = '172.20.0.3';
const request = (socket: string, headers: Record<string, string> = {}) =>
  ({ socket, req: { header: (name: string) => headers[name] } }) as unknown as Context & {
    socket: string;
  };
const remote = (c: Context) => (c as Context & { socket: string }).socket;

describe('client address', () => {
  it('believes cf-connecting-ip only from the tunnel and loopback', async () => {
    const trust = proxyTrust(['tunnel'], async (name) => (name === 'tunnel' ? [TUNNEL] : []));
    await trust.refresh();
    const ip = clientIpResolver(trust, remote);
    const header = { 'cf-connecting-ip': '198.51.100.9' };

    expect(ip(request(TUNNEL, header))).toBe('198.51.100.9');
    expect(ip(request(`::ffff:${TUNNEL}`, header))).toBe('198.51.100.9');
    expect(ip(request('127.0.0.1', header))).toBe('198.51.100.9');
    // Anyone else who reaches the port: their own address, whatever they send.
    expect(ip(request('172.20.0.1', header))).toBe('172.20.0.1');
    expect(ip(request('172.21.0.5', { 'x-forwarded-for': '198.51.100.9' }))).toBe('172.21.0.5');
    // From the tunnel, but not an address: ignored.
    expect(ip(request(TUNNEL, { 'cf-connecting-ip': 'nonsense' }))).toBe(TUNNEL);
    expect(ip(request(TUNNEL))).toBe(TUNNEL);
  });

  it('never believes the header without TRUST_PROXY', () => {
    const ip = clientIpResolver(null, remote);
    expect(ip(request('127.0.0.1', { 'cf-connecting-ip': '198.51.100.9' }))).toBe('127.0.0.1');
  });

  it('follows the tunnel to a new address', async () => {
    let address = TUNNEL;
    const trust = proxyTrust(['tunnel'], async () => [address]);
    await trust.refresh();
    address = '172.20.0.7';
    await trust.refresh();
    expect(trust.trusts('172.20.0.7')).toBe(true);
    expect(trust.trusts(TUNNEL)).toBe(false);
  });
});
