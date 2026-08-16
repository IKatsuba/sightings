import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextMiddleware, NextRequest } from 'next/server';
import { isCrawler } from 'sightings/crawlers';

/**
 * Crawler counting, from middleware.
 *
 * This is the half a JavaScript beacon structurally cannot see. A crawler
 * never runs the beacon, and its request is often served straight from the CDN
 * cache — so no route handler and no server component observes it either. The
 * document request in middleware is the only place it exists.
 *
 * **Do not import your `sightings` instance here.** Middleware runs on the
 * edge, and a storage adapter (Prisma, pg, …) does not. That is why this
 * module reports over HTTP to the mounted route instead of writing directly,
 * and why it only needs to know whether a user agent is a crawler at all — the
 * route re-classifies it anyway, and does not trust this caller.
 *
 * `waitUntil` keeps the report off the critical path: a slow or failing insert
 * never delays the crawl.
 */

export type CrawlerTrackingOptions = {
  /** Where the handler is mounted. Defaults to `/api/pv`. */
  basePath?: string;
  /** Is this a crawler at all? Defaults to `isbot`. */
  detect?: (userAgent: string) => boolean;
};

/**
 * Report a crawler's document request, if that is what this is. Safe to drop
 * into middleware you already have.
 */
export function trackCrawler(
  request: NextRequest,
  event: NextFetchEvent,
  options: CrawlerTrackingOptions = {}
): void {
  // Documents only. A human with JavaScript is counted once, by the beacon;
  // RSC payload fetches and router prefetches would otherwise show an SPA
  // navigation as a second document view.
  if (
    request.method !== 'GET' ||
    request.headers.get('rsc') ||
    request.headers.get('next-router-prefetch')
  ) {
    return;
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  if (!isCrawler(userAgent, options.detect)) return;

  const endpoint = new URL(
    `${options.basePath ?? '/api/pv'}/bot`,
    request.nextUrl.origin
  );

  event.waitUntil(
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: request.nextUrl.href,
        userAgent,
        country:
          request.headers.get('x-vercel-ip-country') ??
          request.headers.get('cf-ipcountry')
      })
    }).catch(() => {
      // A lost crawler view is not worth failing a crawl over.
    })
  );
}

/** Middleware that does nothing but count crawlers. */
export function createSightingsMiddleware(
  options: CrawlerTrackingOptions = {}
): NextMiddleware {
  return function middleware(request: NextRequest, event: NextFetchEvent) {
    trackCrawler(request, event, options);

    return NextResponse.next();
  };
}

/**
 * A matcher for `export const config`. Pages only: the analytics route itself
 * (it would count its own beacon calls), Next internals and anything with a
 * file extension stay out.
 *
 * Add the machine endpoints worth counting by hand. `/llms.txt` is the one to
 * think about first: an AI agent fetching it is precisely the visit a site
 * wants counted, and the extension rule would otherwise drop it.
 */
export const sightingsMatcher = [
  '/((?!api|_next|\\.well-known|.*\\..*).*)',
  '/llms.txt'
];
