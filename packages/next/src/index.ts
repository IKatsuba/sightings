import type { Sightings } from 'sightings';

/**
 * Mount the handler as a Next.js route.
 *
 * ```ts
 * // app/api/pv/[[...sightings]]/route.ts
 * import { analytics } from '@/lib/analytics';
 * import { toNextJsHandler } from '@sightings/next';
 *
 * export const { POST } = toNextJsHandler(analytics);
 * ```
 *
 * The optional catch-all is what lets one file serve both `/api/pv` and
 * `/api/pv/bot`. Nothing here is a page, so keep the route out of your sitemap
 * — the responses already carry `x-robots-tag: noindex`.
 */
export function toNextJsHandler(
  analytics: Sightings | ((request: Request) => Promise<Response>)
): { POST: (request: Request) => Promise<Response> } {
  const handler =
    typeof analytics === 'function' ? analytics : analytics.handler;

  return { POST: (request) => handler(request) };
}
