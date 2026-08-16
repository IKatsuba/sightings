/**
 * URL redaction — the one function the whole privacy claim rests on.
 *
 * It runs twice per pageview on purpose: in the browser before the beacon
 * fires, and again on the server before the row is written. The endpoint is
 * open HTTP, so the server pass is the one a policy page can actually rest on;
 * the browser pass is what keeps the identifier from leaving the device at all.
 */

/**
 * Query parameters that survive by default. Campaign tags only — they say
 * where a visit came from, never who it was, and they are the one thing a
 * launch actually needs from analytics.
 */
export const DEFAULT_ALLOWED_PARAMS: readonly string[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref'
];

export type RedactOptions = {
  /**
   * Path prefixes dropped entirely, because the path itself is the identifier:
   * `/admin/inbox/<userId>`, `/invite/<token>`. A dynamic segment holding a
   * user id, an order id or a bearer token cannot be stripped and the page
   * kept, so the whole subtree goes.
   */
  dropPaths?: readonly string[];
  /**
   * Query parameters that survive redaction. An **allowlist**, not a
   * blocklist, so the next parameter nobody thought about fails closed. Adding
   * one is a decision: it must describe the traffic, never the person.
   */
  allowParams?: readonly string[];
};

export type ResolvedRedact = {
  dropPaths: readonly string[];
  allowParams: ReadonlySet<string>;
};

export function resolveRedact(options: RedactOptions = {}): ResolvedRedact {
  return {
    dropPaths: options.dropPaths ?? [],
    allowParams: new Set(options.allowParams ?? DEFAULT_ALLOWED_PARAMS)
  };
}

function isResolved(
  options: RedactOptions | ResolvedRedact
): options is ResolvedRedact {
  return options.allowParams instanceof Set;
}

/**
 * Drop a url that must not be stored, strip every query parameter outside the
 * allowlist, and return the rest parsed. `null` means "discard this event" and
 * is not an error — it is the redaction doing its job.
 */
export function redactUrl(
  input: string,
  options: RedactOptions | ResolvedRedact = {}
): URL | null {
  const { dropPaths, allowParams } = isResolved(options)
    ? options
    : resolveRedact(options);

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    // An unparseable url cannot be redacted, so it cannot be sent.
    return null;
  }

  if (dropPaths.some((prefix) => url.pathname.startsWith(prefix))) return null;

  for (const key of [...url.searchParams.keys()]) {
    if (!allowParams.has(key)) url.searchParams.delete(key);
  }

  // Fragments never reach a server but do reach analytics, and no metric worth
  // having needs them.
  url.hash = '';

  return url;
}

/**
 * The campaign columns a `Sighting` stores, lifted from an already-redacted
 * url. Shared by the human and the crawler path so the two kinds of row cannot
 * drift on what "campaign tags" means.
 */
export function campaignParams(url: URL): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  ref: string | null;
} {
  return {
    utmSource: url.searchParams.get('utm_source'),
    utmMedium: url.searchParams.get('utm_medium'),
    utmCampaign: url.searchParams.get('utm_campaign'),
    utmContent: url.searchParams.get('utm_content'),
    utmTerm: url.searchParams.get('utm_term'),
    ref: url.searchParams.get('ref')
  };
}

/** A hostname and nothing else — anything with a path, port or scheme goes. */
const REFERRER_HOST = /^[a-z0-9][a-z0-9.-]{0,252}$/i;

/** Keep a referrer only if it is a bare host; otherwise drop it. */
export function redactReferrer(
  referrer: string | null | undefined
): string | null {
  if (!referrer) return null;

  return REFERRER_HOST.test(referrer) ? referrer.toLowerCase() : null;
}
