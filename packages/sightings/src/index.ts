import { createApi, type SightingsApi } from './api';
import { createHandler } from './handler';
import {
  resolveOptions,
  type ResolvedOptions,
  type SightingsOptions
} from './options';

export type Sightings = {
  /** Everything the instance resolved, defaults included. */
  options: ResolvedOptions;
  /**
   * A plain fetch handler. Mount it with an integration (`@sightings/next`) or
   * by hand in any framework that speaks `Request`/`Response`.
   */
  handler: (request: Request) => Promise<Response>;
  /** Record and read without going through HTTP. */
  api: SightingsApi;
};

/**
 * Create an analytics instance.
 *
 * ```ts
 * export const analytics = sightings({
 *   secret: process.env.SIGHTINGS_SECRET,
 *   storage: prismaAdapter(db),
 *   redact: { dropPaths: ['/admin', '/invite'] }
 * });
 * ```
 *
 * What it counts, and what it refuses to: pageviews from people (cookieless —
 * nothing written to the device, nothing read back) and document requests from
 * crawlers and AI agents, which never run a beacon and are otherwise invisible.
 * What it will not do is custom events with arbitrary payloads. That is the
 * feature request that turns anonymous aggregates into personal data, and it is
 * missing on purpose.
 */
export function sightings(options: SightingsOptions): Sightings {
  const resolved = resolveOptions(options);
  const api = createApi(resolved);

  return {
    options: resolved,
    api,
    handler: createHandler(resolved, api)
  };
}

export { SightingsError } from './api';
export type { CrawlerInput, PageviewInput, SightingsApi } from './api';
export {
  crawlerName,
  isCrawler,
  DEFAULT_CRAWLER_FAMILIES,
  type CrawlerFamily,
  type CrawlerOptions
} from './crawlers';
export type { ResolvedOptions, SightingsOptions } from './options';
export {
  campaignParams,
  redactReferrer,
  redactUrl,
  resolveRedact,
  DEFAULT_ALLOWED_PARAMS,
  type RedactOptions,
  type ResolvedRedact
} from './redact';
export {
  memoryStorage,
  type SightingsStorage,
  type SightingsSummary,
  type SummaryRange
} from './storage';
export type { Sighting } from './types';
export { visitorId, type VisitorInput, type VisitorWindow } from './visitor';
