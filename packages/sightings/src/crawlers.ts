import { isbot } from 'isbot';

/**
 * Crawler classification.
 *
 * Crawlers and AI agents never run a browser beacon, so a cookieless counter
 * that only listens to JavaScript is blind to the half of the audience that
 * matters most in 2026: the models that read your pages and answer questions
 * about them. This module is what makes that half countable — and countable by
 * *family name*, never by raw user agent.
 */

/** `[substring matched against the lowercased UA, stored family name]`. */
export type CrawlerFamily = readonly [pattern: string, name: string];

/**
 * Families worth a name of their own in a query, first hit wins. Grouped by
 * why anyone cares: AI agents are the audience a modern site courts
 * (llms.txt, AI-SEO), previews say a shared link actually unfurled somewhere,
 * search crawlers say indexing happens.
 */
export const DEFAULT_CRAWLER_FAMILIES: readonly CrawlerFamily[] = [
  // AI crawlers and agents
  ['oai-searchbot', 'oai-searchbot'],
  ['chatgpt-user', 'chatgpt-user'],
  ['gptbot', 'gptbot'],
  ['claude-searchbot', 'claude-searchbot'],
  ['claude-user', 'claude-user'],
  ['claudebot', 'claudebot'],
  ['perplexity-user', 'perplexity-user'],
  ['perplexitybot', 'perplexitybot'],
  ['bytespider', 'bytespider'],
  ['ccbot', 'ccbot'],
  ['meta-externalagent', 'meta-externalagent'],
  ['amazonbot', 'amazonbot'],
  ['applebot', 'applebot'],
  // Search engines
  ['googlebot', 'googlebot'],
  ['bingbot', 'bingbot'],
  ['duckduckbot', 'duckduckbot'],
  ['yandex', 'yandex'],
  ['baiduspider', 'baidu'],
  // SEO tooling
  ['ahrefsbot', 'ahrefs'],
  ['semrushbot', 'semrush'],
  // Link previews — a hit means a shared link unfurled in that app
  ['telegrambot', 'telegram-preview'],
  ['twitterbot', 'x-preview'],
  ['facebookexternalhit', 'facebook-preview'],
  ['linkedinbot', 'linkedin-preview'],
  ['slackbot', 'slack-preview'],
  ['discordbot', 'discord-preview'],
  ['whatsapp', 'whatsapp-preview']
];

export type CrawlerOptions = {
  /** Replaces the default list rather than extending it. */
  families?: readonly CrawlerFamily[];
  /** Extra families checked before the defaults. */
  extraFamilies?: readonly CrawlerFamily[];
  /** Is this a crawler at all? Defaults to `isbot`. */
  detect?: (userAgent: string) => boolean;
  /** Stored name for a crawler nobody listed. Defaults to `other`. */
  fallback?: string;
};

/** Is this user agent a crawler of any kind? */
export function isCrawler(
  userAgent: string,
  detect: (userAgent: string) => boolean = isbot
): boolean {
  return Boolean(userAgent) && detect(userAgent);
}

/**
 * The stored family name for a crawler user agent, or `null` for a human one.
 * Never returns the raw user agent.
 */
export function crawlerName(
  userAgent: string,
  options: CrawlerOptions = {}
): string | null {
  if (!isCrawler(userAgent, options.detect)) return null;

  const ua = userAgent.toLowerCase();
  const families = [
    ...(options.extraFamilies ?? []),
    ...(options.families ?? DEFAULT_CRAWLER_FAMILIES)
  ];

  for (const [pattern, name] of families) {
    if (ua.includes(pattern)) return name;
  }

  return options.fallback ?? 'other';
}
