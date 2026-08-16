/**
 * The visitor id: sha256 over (secret, UTC day, IP, user agent).
 *
 * The day inside the input rotates the identifier every 24h, and sha256 does
 * not run backwards — no stored hash turns back into an IP, and neither the IP
 * nor the user agent is ever written down.
 *
 * Be precise about what that buys, because the sloppy version of this sentence
 * is what makes analytics vendors untrustworthy. It does **not** prevent
 * recomputing the hash *forward* from the secret plus a known person's IP and
 * user agent — if your app stores those anywhere (a session table, a request
 * log), the linkage is arithmetic, not cryptography. So the stored id is
 * pseudonymous to the site operator, not anonymous, and "we never join it to a
 * person" is a promise about conduct that your code has to keep.
 *
 * Truncated to 128 bits, which cannot collide at any traffic a site this size
 * will ever see.
 */

/** How often the hash changes for the same visitor. */
export type VisitorWindow = 'daily' | 'hourly';

export type VisitorInput = {
  secret: string;
  ip: string;
  userAgent: string;
  at: Date;
  window?: VisitorWindow;
};

const HEX = '0123456789abcdef';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += HEX[byte >> 4]! + HEX[byte & 15]!;
  }

  return out;
}

/**
 * Uses Web Crypto rather than `node:crypto` so the same code runs in Node,
 * Deno, Bun, Vercel Edge and Cloudflare Workers — the visitor hash is computed
 * wherever the handler is mounted, and that is not always Node.
 */
export async function visitorId(input: VisitorInput): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'sightings: Web Crypto is unavailable — Node 20+, Deno, Bun, Vercel Edge and Cloudflare Workers all provide globalThis.crypto.subtle.'
    );
  }

  const stamp = input.at.toISOString();
  const bucket =
    input.window === 'hourly' ? stamp.slice(0, 13) : stamp.slice(0, 10);
  const message = [input.secret, bucket, input.ip, input.userAgent].join('\n');

  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(message)
  );

  return toHex(new Uint8Array(digest)).slice(0, 32);
}
