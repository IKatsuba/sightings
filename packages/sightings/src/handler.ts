import type { SightingsApi } from './api';
import { isCrawler } from './crawlers';
import { headerValue, type ResolvedOptions } from './options';

/**
 * The HTTP surface: two POST endpoints under `basePath`.
 *
 * - `POST {basePath}` — the human beacon, called by `sendBeacon`.
 * - `POST {basePath}/bot` — a crawler view, reported by middleware.
 *
 * They are separate on purpose. The beacon body is `{ url, referrer }` and
 * nothing else, and that strictness is a policy invariant rather than
 * housekeeping: an extra field is how a "pageview" quietly becomes a custom
 * event with an arbitrary payload. A crawler report needs different fields —
 * the user agent to classify — and must not be able to loosen the human one.
 *
 * Neither endpoint trusts its caller. Middleware is the expected source of bot
 * reports, but anyone can POST there, so the user agent is re-classified and a
 * human one is refused: the crawler route is not a side door into human
 * counts. Responses carry no body — `sendBeacon` cannot read one anyway.
 */

const RESPONSE_HEADERS = {
  'cache-control': 'no-store',
  // Nothing here is a page, and a 405 with a crawlable url is still a url.
  'x-robots-tag': 'noindex'
};

const respond = (status: number): Response =>
  new Response(null, { status, headers: RESPONSE_HEADERS });

/** Strict: an unknown key is a 400, not a field to ignore. */
function parseBeacon(
  body: unknown
): { url: string; referrer: string | null } | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'url' && key !== 'referrer') return null;
  }

  const { url, referrer } = record;
  if (typeof url !== 'string' || !url || url.length > 2048) return null;

  if (referrer === undefined || referrer === null)
    return { url, referrer: null };
  if (typeof referrer !== 'string' || referrer.length > 253) return null;

  return { url, referrer };
}

function parseCrawlerReport(
  body: unknown
): { url: string; userAgent: string; country: string | null } | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'url' && key !== 'userAgent' && key !== 'country') return null;
  }

  const { url, userAgent, country } = record;
  if (typeof url !== 'string' || !url || url.length > 2048) return null;
  if (typeof userAgent !== 'string' || !userAgent || userAgent.length > 512) {
    return null;
  }
  if (country !== undefined && country !== null) {
    if (typeof country !== 'string' || country.length > 2) return null;
  }

  return {
    url,
    userAgent,
    country: typeof country === 'string' ? country : null
  };
}

async function readJson(request: Request): Promise<unknown> {
  // `sendBeacon` is inconsistent about content-type, so parse the text rather
  // than trusting the header.
  return JSON.parse(await request.text()) as unknown;
}

/** The remainder of the path after `basePath`, or `null` for a foreign url. */
function route(pathname: string, basePath: string): string | null {
  if (basePath === '/') return pathname;
  if (!pathname.startsWith(basePath)) return null;

  const rest = pathname.slice(basePath.length);
  if (rest !== '' && !rest.startsWith('/')) return null;

  return rest.replace(/\/$/, '') || '/';
}

export function createHandler(
  options: ResolvedOptions,
  api: SightingsApi
): (request: Request) => Promise<Response> {
  return async function handler(request: Request): Promise<Response> {
    const matched = route(new URL(request.url).pathname, options.basePath);
    if (matched === null || (matched !== '/' && matched !== '/bot')) {
      return respond(404);
    }

    if (request.method !== 'POST') return respond(405);

    if (!options.secret) {
      // Recording is off rather than unsalted. Zero rows after this means a
      // missing secret, not zero visitors — which is why it is a 503 and not a
      // quiet 204.
      return respond(503);
    }

    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      return respond(400);
    }

    try {
      if (matched === '/bot') {
        const report = parseCrawlerReport(body);
        if (!report) return respond(400);

        await api.crawler(report);

        return respond(204);
      }

      const userAgent = request.headers.get('user-agent') ?? '';
      // Counted human traffic means humans. A crawler that does run JS is
      // still counted — once, through the crawler route.
      if (!userAgent || isCrawler(userAgent, options.crawlers.detect)) {
        return respond(204);
      }

      const beacon = parseBeacon(body);
      if (!beacon) return respond(400);

      await api.pageview({
        ...beacon,
        userAgent,
        ip: headerValue(request, options.ipHeaders) ?? '',
        country: headerValue(request, options.countryHeaders)
      });

      return respond(204);
    } catch (error) {
      options.onError(error);

      return respond(500);
    }
  };
}
