import { describe, expect, it } from 'vitest';

import { visitorId } from './visitor';

const base = {
  secret: 'a-secret-long-enough-to-be-a-secret',
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0 (Macintosh) Chrome/131',
  at: new Date('2026-08-16T09:00:00.000Z')
};

describe('visitorId', () => {
  it('is stable within the day, so a session is one visitor', async () => {
    const morning = await visitorId(base);
    const evening = await visitorId({
      ...base,
      at: new Date('2026-08-16T23:59:59.000Z')
    });

    expect(morning).toBe(evening);
  });

  it('rotates at the UTC day boundary', async () => {
    const today = await visitorId(base);
    const tomorrow = await visitorId({
      ...base,
      at: new Date('2026-08-17T00:00:01.000Z')
    });

    expect(tomorrow).not.toBe(today);
  });

  it('rotates hourly when asked', async () => {
    const first = await visitorId({ ...base, window: 'hourly' });
    const later = await visitorId({
      ...base,
      window: 'hourly',
      at: new Date('2026-08-16T10:00:00.000Z')
    });

    expect(later).not.toBe(first);
  });

  it('changes with the secret, which is what makes it a kill switch', async () => {
    expect(await visitorId({ ...base, secret: 'other' })).not.toBe(
      await visitorId(base)
    );
  });

  it('separates two visitors on the same network', async () => {
    expect(await visitorId({ ...base, ip: '203.0.113.8' })).not.toBe(
      await visitorId(base)
    );
    expect(await visitorId({ ...base, userAgent: 'Firefox/140' })).not.toBe(
      await visitorId(base)
    );
  });

  it('stores 128 bits of hex and nothing that looks like an input', async () => {
    const id = await visitorId(base);

    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain('203.0.113');
  });
});
