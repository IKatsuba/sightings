import { describe, expect, it } from 'vitest';

import { crawlerName, isCrawler } from './crawlers';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

describe('crawlerName', () => {
  it('names the AI agents, which is the whole reason this exists', () => {
    expect(
      crawlerName(
        'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)'
      )
    ).toBe('gptbot');
    expect(crawlerName('Mozilla/5.0 (compatible; ClaudeBot/1.0)')).toBe(
      'claudebot'
    );
    expect(crawlerName('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe(
      'perplexitybot'
    );
  });

  it('names a link preview, so a share is visible as a share', () => {
    expect(crawlerName('TelegramBot (like TwitterBot)')).toBe(
      'telegram-preview'
    );
  });

  it('falls back to `other` for a crawler nobody listed', () => {
    expect(
      crawlerName('Mozilla/5.0 (compatible; SomeNewBot/0.1; +http://x.test)')
    ).toBe('other');
  });

  it('returns null for a human, and never the raw user agent', () => {
    expect(crawlerName(CHROME)).toBeNull();
    expect(crawlerName('')).toBeNull();
  });

  it('takes extra families ahead of the defaults', () => {
    const name = crawlerName('Mozilla/5.0 (compatible; Googlebot/2.1)', {
      extraFamilies: [['googlebot', 'google-search']]
    });

    expect(name).toBe('google-search');
  });

  it('honours a custom detector', () => {
    expect(crawlerName(CHROME, { detect: () => true })).toBe('other');
  });
});

describe('isCrawler', () => {
  it('separates the two audiences', () => {
    expect(isCrawler('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
    expect(isCrawler(CHROME)).toBe(false);
  });
});
