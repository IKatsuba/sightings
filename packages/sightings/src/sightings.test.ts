import { beforeEach, describe, expect, it } from 'vitest';

import { sightings } from './index';
import { memoryStorage } from './storage';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const GPTBOT =
  'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)';

const storage = memoryStorage();

const instance = () =>
  sightings({
    secret: 'test-secret',
    storage,
    redact: { dropPaths: ['/admin', '/invite'] },
    now: () => new Date('2026-08-16T09:00:00.000Z')
  });

const beacon = (body: unknown, userAgent = CHROME, path = '/api/pv') =>
  new Request(`https://example.com${path}`, {
    method: 'POST',
    headers: { 'user-agent': userAgent, 'x-real-ip': '203.0.113.7' },
    body: JSON.stringify(body)
  });

beforeEach(() => {
  storage.clear();
});

describe('the human beacon', () => {
  it('records a redacted row', async () => {
    const response = await instance().handler(
      beacon({
        url: 'https://example.com/pricing?utm_source=telegram&session_id=cs_live_1',
        referrer: 'news.ycombinator.com'
      })
    );

    expect(response.status).toBe(204);
    expect(storage.all()).toHaveLength(1);
    expect(storage.all()[0]).toMatchObject({
      path: '/pricing',
      referrer: 'news.ycombinator.com',
      utmSource: 'telegram',
      bot: false,
      botName: null,
      country: null
    });
    expect(storage.all()[0]?.visitor).toMatch(/^[0-9a-f]{32}$/);
  });

  it('refuses an extra field instead of storing it', async () => {
    const response = await instance().handler(
      beacon({ url: 'https://example.com/', referrer: null, event: 'signup' })
    );

    expect(response.status).toBe(400);
    expect(storage.all()).toHaveLength(0);
  });

  it('refuses a body that is not a beacon at all', async () => {
    for (const body of [null, [], { referrer: 'x' }, { url: 42 }]) {
      expect((await instance().handler(beacon(body))).status).toBe(400);
    }

    expect(storage.all()).toHaveLength(0);
  });

  it('does not count a crawler that runs JavaScript', async () => {
    const response = await instance().handler(
      beacon({ url: 'https://example.com/' }, GPTBOT)
    );

    expect(response.status).toBe(204);
    expect(storage.all()).toHaveLength(0);
  });

  it('drops a url the redaction drops, and says nothing about it', async () => {
    const response = await instance().handler(
      beacon({ url: 'https://example.com/invite/tok_live_abc' })
    );

    expect(response.status).toBe(204);
    expect(storage.all()).toHaveLength(0);
  });

  it('reads the country from whatever header the edge set', async () => {
    const request = new Request('https://example.com/api/pv', {
      method: 'POST',
      headers: {
        'user-agent': CHROME,
        'x-real-ip': '203.0.113.7',
        'cf-ipcountry': 'DE'
      },
      body: JSON.stringify({ url: 'https://example.com/' })
    });

    await instance().handler(request);

    expect(storage.all()[0]?.country).toBe('DE');
  });
});

describe('the crawler route', () => {
  it('records a family name and no visitor', async () => {
    const response = await instance().handler(
      beacon(
        {
          url: 'https://example.com/llms.txt',
          userAgent: GPTBOT,
          country: 'US'
        },
        CHROME,
        '/api/pv/bot'
      )
    );

    expect(response.status).toBe(204);
    expect(storage.all()[0]).toMatchObject({
      path: '/llms.txt',
      bot: true,
      botName: 'gptbot',
      visitor: null,
      referrer: null,
      country: 'US'
    });
  });

  it('is not a side door into the human counts', async () => {
    const response = await instance().handler(
      beacon(
        { url: 'https://example.com/', userAgent: CHROME },
        CHROME,
        '/api/pv/bot'
      )
    );

    expect(response.status).toBe(204);
    expect(storage.all()).toHaveLength(0);
  });

  it('applies the same redaction as the human path', async () => {
    await instance().handler(
      beacon(
        { url: 'https://example.com/admin/inbox/user_42', userAgent: GPTBOT },
        CHROME,
        '/api/pv/bot'
      )
    );

    expect(storage.all()).toHaveLength(0);
  });
});

describe('the handler itself', () => {
  it('records nothing at all without a secret', async () => {
    const unsalted = sightings({ storage });
    const response = await unsalted.handler(
      beacon({ url: 'https://example.com/' })
    );

    // 503 and not a quiet 204: zero rows must read as a missing secret rather
    // than as zero visitors.
    expect(response.status).toBe(503);
    expect(storage.all()).toHaveLength(0);
  });

  it('answers 405 to a GET and 404 off its base path', async () => {
    const analytics = instance();

    expect(
      (await analytics.handler(new Request('https://example.com/api/pv')))
        .status
    ).toBe(405);
    expect(
      (
        await analytics.handler(
          new Request('https://example.com/api/pvx', { method: 'POST' })
        )
      ).status
    ).toBe(404);
  });

  it('keeps itself out of search results', async () => {
    const response = await instance().handler(
      beacon({ url: 'https://example.com/' })
    );

    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('honours a custom base path', async () => {
    const analytics = sightings({
      secret: 'test-secret',
      storage,
      basePath: '/x'
    });

    const response = await analytics.handler(
      new Request('https://example.com/x', {
        method: 'POST',
        headers: { 'user-agent': CHROME },
        body: JSON.stringify({ url: 'https://example.com/' })
      })
    );

    expect(response.status).toBe(204);
    expect(storage.all()).toHaveLength(1);
  });

  it('reports a storage failure instead of pretending to have stored', async () => {
    const errors: unknown[] = [];
    const analytics = sightings({
      secret: 'test-secret',
      storage: {
        record() {
          throw new Error('database is on fire');
        }
      },
      onError: (error) => errors.push(error)
    });

    const response = await analytics.handler(
      beacon({ url: 'https://example.com/' })
    );

    expect(response.status).toBe(500);
    expect(errors).toHaveLength(1);
  });
});

describe('api', () => {
  it('summarises what it recorded', async () => {
    const analytics = instance();

    await analytics.api.pageview({
      url: 'https://example.com/a',
      ip: '1.1.1.1'
    });
    await analytics.api.pageview({
      url: 'https://example.com/a',
      ip: '1.1.1.1'
    });
    await analytics.api.pageview({
      url: 'https://example.com/b',
      ip: '2.2.2.2'
    });
    await analytics.api.crawler({
      url: 'https://example.com/a',
      userAgent: GPTBOT
    });

    const summary = await analytics.api.summary({
      from: new Date('2026-08-16T00:00:00.000Z'),
      to: new Date('2026-08-17T00:00:00.000Z'),
      bot: false
    });

    expect(summary.views).toBe(3);
    expect(summary.visitors).toBe(2);
    expect(summary.paths[0]).toEqual({ path: '/a', views: 2 });
  });

  it('throws a readable error when the adapter cannot read', async () => {
    const analytics = sightings({
      secret: 'test-secret',
      storage: { record: () => {} }
    });

    await expect(
      analytics.api.summary({ from: new Date(), to: new Date() })
    ).rejects.toThrow(/write-only/);
  });
});
