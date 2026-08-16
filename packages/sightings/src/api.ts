import { crawlerName } from './crawlers';
import type { ResolvedOptions } from './options';
import { campaignParams, redactReferrer, redactUrl } from './redact';
import type { SightingsSummary, SummaryRange } from './storage';
import type { Sighting } from './types';
import { visitorId } from './visitor';

export class SightingsError extends Error {
  override name = 'SightingsError';
}

export type PageviewInput = {
  url: string;
  /** External referrer host only. Anything else is dropped, not truncated. */
  referrer?: string | null;
  ip?: string;
  userAgent?: string;
  country?: string | null;
  at?: Date;
};

export type CrawlerInput = {
  url: string;
  userAgent: string;
  country?: string | null;
  at?: Date;
};

export type SightingsApi = {
  /**
   * Record a human pageview. Returns the stored row, or `null` when redaction
   * dropped it — which is a normal outcome, not a failure.
   */
  pageview(input: PageviewInput): Promise<Sighting | null>;
  /** Record a crawler view. `null` when the user agent is human, or the url is dropped. */
  crawler(input: CrawlerInput): Promise<Sighting | null>;
  /** Read side. Throws if the storage adapter does not implement it. */
  summary(range: SummaryRange): Promise<SightingsSummary>;
};

export function createApi(options: ResolvedOptions): SightingsApi {
  return {
    async pageview(input) {
      if (!options.secret) {
        throw new SightingsError(
          'recording is disabled: no `secret` was configured, and an unsalted visitor hash is not a hash worth storing.'
        );
      }

      const url = redactUrl(input.url, options.redact);
      if (!url) return null;

      const at = input.at ?? options.now();

      const sighting: Sighting = {
        path: url.pathname,
        referrer: redactReferrer(input.referrer),
        ...campaignParams(url),
        visitor: await visitorId({
          secret: options.secret,
          ip: input.ip ?? '',
          userAgent: input.userAgent ?? '',
          at,
          window: options.visitorWindow
        }),
        country: input.country ?? null,
        bot: false,
        botName: null,
        createdAt: at
      };

      await options.storage.record(sighting);

      return sighting;
    },

    async crawler(input) {
      const name = crawlerName(input.userAgent, options.crawlers);
      if (!name) return null;

      const url = redactUrl(input.url, options.redact);
      if (!url) return null;

      const sighting: Sighting = {
        path: url.pathname,
        // A crawler's referrer says nothing a crawl needs, and the hash would
        // distinguish nothing worth distinguishing.
        referrer: null,
        ...campaignParams(url),
        visitor: null,
        country: input.country ?? null,
        bot: true,
        botName: name,
        createdAt: input.at ?? options.now()
      };

      await options.storage.record(sighting);

      return sighting;
    },

    async summary(range) {
      if (!options.storage.summary) {
        throw new SightingsError(
          'this storage adapter is write-only: it implements `record` but not `summary`. Query the table directly, or use an adapter that reads.'
        );
      }

      return options.storage.summary(range);
    }
  };
}
