import { describe, expect, it } from 'vitest';

import { campaignParams, redactReferrer, redactUrl } from './redact';

const redact = { dropPaths: ['/admin', '/invite'] };

describe('redactUrl', () => {
  it('keeps a plain page url untouched', () => {
    expect(redactUrl('https://example.com/pricing', redact)?.toString()).toBe(
      'https://example.com/pricing'
    );
  });

  it('strips a query parameter nobody allowed', () => {
    const url = redactUrl(
      'https://example.com/checkout/success?session_id=cs_live_abc123',
      redact
    );

    expect(url?.toString()).toBe('https://example.com/checkout/success');
    expect(url?.searchParams.get('session_id')).toBeNull();
  });

  it('keeps campaign tags, because they describe traffic and not people', () => {
    const url = redactUrl(
      'https://example.com/?utm_source=telegram&utm_campaign=launch&ref=hn&fbclid=x',
      redact
    );

    expect(url?.searchParams.get('utm_source')).toBe('telegram');
    expect(url?.searchParams.get('ref')).toBe('hn');
    expect(url?.searchParams.get('fbclid')).toBeNull();
  });

  it('drops a subtree whose path is itself the identifier', () => {
    expect(
      redactUrl('https://example.com/admin/inbox/user_42', redact)
    ).toBeNull();
    expect(
      redactUrl('https://example.com/invite/tok_live_abc', redact)
    ).toBeNull();
  });

  it('drops the fragment', () => {
    expect(redactUrl('https://example.com/docs#section-3', redact)?.hash).toBe(
      ''
    );
  });

  it('drops a url it cannot parse, rather than passing it through', () => {
    expect(redactUrl('not-a-url', redact)).toBeNull();
  });

  it('allows nothing but the allowlist when one is given', () => {
    const url = redactUrl('https://example.com/?ref=hn&utm_source=x', {
      allowParams: ['ref']
    });

    expect(url?.searchParams.get('ref')).toBe('hn');
    expect(url?.searchParams.get('utm_source')).toBeNull();
  });
});

describe('campaignParams', () => {
  it('lifts the six campaign columns and nothing else', () => {
    const url = new URL(
      'https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&utm_content=d&utm_term=e&ref=f'
    );

    expect(campaignParams(url)).toEqual({
      utmSource: 'a',
      utmMedium: 'b',
      utmCampaign: 'c',
      utmContent: 'd',
      utmTerm: 'e',
      ref: 'f'
    });
  });
});

describe('redactReferrer', () => {
  it('keeps a bare host, lowercased', () => {
    expect(redactReferrer('News.YCombinator.com')).toBe('news.ycombinator.com');
  });

  it('refuses anything carrying a path, scheme or port', () => {
    expect(redactReferrer('https://t.co/abc')).toBeNull();
    expect(redactReferrer('t.co/abc')).toBeNull();
    expect(redactReferrer('t.co:443')).toBeNull();
  });

  it('treats an absent referrer as a direct visit', () => {
    expect(redactReferrer(null)).toBeNull();
    expect(redactReferrer('')).toBeNull();
  });
});
