import type { CrawlerOptions } from './crawlers';
import {
  resolveRedact,
  type RedactOptions,
  type ResolvedRedact
} from './redact';
import type { SightingsStorage } from './storage';
import type { VisitorWindow } from './visitor';

export type SightingsOptions = {
  /**
   * Salt for the visitor hash. **Without it nothing is recorded** — the
   * handler answers 503 rather than writing unsalted rows, because an unsalted
   * hash of an IP is just an IP with extra steps.
   *
   * Any random 32+ byte string. Rotating it resets visitor continuity, which
   * is a feature: it is the kill switch for the whole pseudonymous linkage.
   */
  secret?: string;
  storage: SightingsStorage;
  /**
   * Where the handler is mounted. Defaults to `/api/pv`.
   *
   * Deliberately unremarkable, and worth keeping that way: `/api/analytics`
   * and `/api/track`-shaped names sit in the ad-blocker filter lists, and a
   * blocked beacon undercounts exactly the privacy-conscious slice of an
   * audience this design is built to respect.
   */
  basePath?: string;
  redact?: RedactOptions;
  crawlers?: CrawlerOptions;
  /** How often a visitor hash rotates. Defaults to `daily`. */
  visitorWindow?: VisitorWindow;
  /** Request headers carrying the client IP, in order of preference. */
  ipHeaders?: readonly string[];
  /** Request headers carrying a country code, in order of preference. */
  countryHeaders?: readonly string[];
  /** Clock, so tests do not have to wait for tomorrow. */
  now?: () => Date;
  /**
   * Called when a write throws. Default: swallow. A lost pageview must never
   * become a failed page — but a silently lost *table* should be findable, so
   * pass a logger here in production.
   */
  onError?: (error: unknown) => void;
};

export type ResolvedOptions = {
  secret: string | undefined;
  storage: SightingsStorage;
  basePath: string;
  redact: ResolvedRedact;
  crawlers: CrawlerOptions;
  visitorWindow: VisitorWindow;
  ipHeaders: readonly string[];
  countryHeaders: readonly string[];
  now: () => Date;
  onError: (error: unknown) => void;
};

/**
 * Vercel and Cloudflare both hand the edge a country for free; the rest are
 * common proxy conventions. A header nobody sets simply yields `null`.
 */
const DEFAULT_COUNTRY_HEADERS = [
  'x-vercel-ip-country',
  'cf-ipcountry',
  'x-country-code'
];

const DEFAULT_IP_HEADERS = ['x-real-ip', 'x-forwarded-for'];

export function resolveOptions(options: SightingsOptions): ResolvedOptions {
  const basePath = (options.basePath ?? '/api/pv').replace(/\/+$/, '');

  return {
    secret: options.secret,
    storage: options.storage,
    basePath: basePath || '/',
    redact: resolveRedact(options.redact),
    crawlers: options.crawlers ?? {},
    visitorWindow: options.visitorWindow ?? 'daily',
    ipHeaders: options.ipHeaders ?? DEFAULT_IP_HEADERS,
    countryHeaders: options.countryHeaders ?? DEFAULT_COUNTRY_HEADERS,
    now: options.now ?? (() => new Date()),
    onError: options.onError ?? (() => {})
  };
}

/**
 * The first value any of `headers` carries. `x-forwarded-for` is a list, and
 * only its first entry is the client — the rest are proxies.
 */
export function headerValue(
  request: Request,
  headers: readonly string[]
): string | null {
  for (const name of headers) {
    const value = request.headers.get(name);
    if (value) return value.split(',')[0]!.trim();
  }

  return null;
}
