/**
 * One recorded observation — the row a storage adapter writes.
 *
 * The name is the whole design argument: a row is a *sighting*, not a person.
 * Nothing here is an identifier by itself, and the one field that comes close
 * (`visitor`) is a salted hash that rotates every day — see `visitor.ts` for
 * exactly how far that goes, and where it stops.
 */
export type Sighting = {
  /** Pathname of the redacted url. The query never lands here. */
  path: string;
  /**
   * Host of an external referrer (`t.co`, `news.ycombinator.com`), or null for
   * a direct, internal or crawler visit. Never a full url: foreign paths carry
   * tokens and ids that are not yours to keep.
   */
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** The `?ref=` tag aggregators append; same allowlist as the `utm_*` set. */
  ref: string | null;
  /** Daily-rotating visitor hash. Null on crawler rows. */
  visitor: string | null;
  /** Coarse country code, from whatever header the host edge sets. */
  country: string | null;
  /**
   * A crawler or AI-agent view rather than a human one. Human queries filter
   * on `bot = false`; forgetting to is the one way this column inflates a
   * launch metric.
   */
  bot: boolean;
  /**
   * Crawler family from the declared user agent (`googlebot`, `gptbot`,
   * `claudebot`, … or `other`). Crawler rows only, and never the raw UA — a
   * family name cannot smuggle what a UA string sometimes carries.
   */
  botName: string | null;
  createdAt: Date;
};
