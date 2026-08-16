import { describe, expect, it, vi } from 'vitest';

import { prismaAdapter } from './index';

const sighting = {
  path: '/pricing',
  referrer: 'news.ycombinator.com',
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  ref: null,
  visitor: 'deadbeef',
  country: 'DE',
  bot: false,
  botName: null,
  createdAt: new Date('2026-08-16T09:00:00.000Z')
};

const fakeClient = () => {
  const create = vi.fn().mockResolvedValue(undefined);
  const count = vi.fn().mockResolvedValue(3);
  const groupBy = vi.fn(async (args: Record<string, unknown>) => {
    const [key] = args.by as string[];

    if (key === 'visitor') return [{ visitor: 'a' }, { visitor: 'b' }];
    if (key === 'path') {
      return [
        { path: '/a', _count: { _all: 2 } },
        { path: '/b', _count: { _all: 1 } }
      ];
    }

    return [];
  });

  return {
    client: { sighting: { create, count, groupBy } },
    create,
    count,
    groupBy
  };
};

describe('prismaAdapter', () => {
  it('writes the row as-is — the columns are the contract', async () => {
    const { client, create } = fakeClient();

    await prismaAdapter(client).record(sighting);

    expect(create).toHaveBeenCalledWith({ data: sighting });
  });

  it('writes to a renamed model when told', async () => {
    const create = vi.fn().mockResolvedValue(undefined);

    await prismaAdapter({ pageView: { create } }, { model: 'pageView' }).record(
      sighting
    );

    expect(create).toHaveBeenCalledOnce();
  });

  it('says which model is missing rather than throwing `undefined`', async () => {
    await expect(prismaAdapter({}).record(sighting)).rejects.toThrow(
      /has no `sighting` model/
    );
  });

  it('summarises through count and groupBy', async () => {
    const { client, groupBy } = fakeClient();

    const summary = await prismaAdapter(client).summary!({
      from: new Date('2026-08-01'),
      to: new Date('2026-08-31'),
      bot: false
    });

    expect(summary).toMatchObject({
      views: 3,
      visitors: 2,
      paths: [
        { path: '/a', views: 2 },
        { path: '/b', views: 1 }
      ]
    });

    // A summary of humans must not silently include crawlers.
    expect(groupBy.mock.calls[0]?.[0]?.where).toMatchObject({ bot: false });
  });
});
