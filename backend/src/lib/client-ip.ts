import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Context } from 'hono';

/**
 * The visitor's address. Behind the Cloudflare Tunnel, Cloudflare sends it in cf-connecting-ip,
 * but anyone who reaches the app's port could send that header too. So it is believed only from
 * the proxies named in TRUST_PROXY (production: `tunnel`, the cloudflared container, looked up
 * in Docker's DNS) and from loopback (checks run inside the container). Everyone else gets their
 * socket address, so the header can't be forged to dodge the sign-in rate limits.
 */

const LOOPBACK = new Set(['127.0.0.1', '::1']);
/** How often an unknown peer that sends the header may trigger a fresh lookup (a recreated tunnel container gets a new address). */
const RELOOKUP_MS = 10_000;

const plain = (address: string | undefined) =>
  address?.startsWith('::ffff:') ? address.slice(7) : address;

type Resolve = (name: string) => Promise<string[]>;
const resolveAll: Resolve = async (name) =>
  (await lookup(name, { all: true })).map((entry) => entry.address);

export interface ProxyTrust {
  trusts(address: string): boolean;
  /** Looks the names up again; resolves when done (the server doesn't wait for it). */
  refresh(): Promise<void>;
}

export function proxyTrust(names: string[], resolve: Resolve = resolveAll): ProxyTrust {
  const fixed = names.filter((name) => isIP(name));
  const hosts = names.filter((name) => !isIP(name));
  let known = new Set(fixed);
  let lookedUp = 0;

  async function refresh() {
    lookedUp = Date.now();
    const found = new Set(fixed);
    for (const host of hosts) {
      for (const address of await resolve(host).catch(() => [])) found.add(plain(address)!);
    }
    known = found;
  }

  return {
    refresh,
    trusts(address) {
      if (LOOPBACK.has(address) || known.has(address)) return true;
      if (hosts.length && Date.now() - lookedUp > RELOOKUP_MS) void refresh();
      return false;
    },
  };
}

/** The resolver the app uses: `remote` is the socket's address (getConnInfo in the Node server). */
export function clientIpResolver(
  trust: ProxyTrust | null,
  remote: (c: Context) => string | undefined,
) {
  return (c: Context): string => {
    let socket: string | undefined;
    try {
      socket = plain(remote(c));
    } catch {
      socket = undefined;
    }
    socket ||= '0.0.0.0';
    const forwarded = c.req.header('cf-connecting-ip')?.trim();
    if (trust && forwarded && isIP(forwarded) && trust.trusts(socket)) return forwarded;
    return socket;
  };
}
