import type { Sighting } from './types';

/**
 * Where sightings land. Writing is the only method an adapter must implement;
 * reading is optional, because plenty of setups query the table with SQL and
 * never call the library back.
 */
export type SightingsStorage = {
  record(sighting: Sighting): Promise<void> | void;
  summary?(range: SummaryRange): Promise<SightingsSummary>;
};

export type SummaryRange = {
  from: Date;
  to: Date;
  /** `false` for humans, `true` for crawlers, omitted for both. */
  bot?: boolean;
  /** How many rows per top-list. Defaults to 10. */
  limit?: number;
};

export type SightingsSummary = {
  views: number;
  /** Distinct daily-rotating hashes — an approximation of people, not people. */
  visitors: number;
  paths: Array<{ path: string; views: number }>;
  referrers: Array<{ referrer: string; views: number }>;
  crawlers: Array<{ botName: string; views: number }>;
};

/**
 * An in-memory adapter. Real use is tests and `pnpm dev` — it forgets
 * everything on restart, which is the point: you can wire the whole pipeline
 * up before deciding where the rows should live.
 */
export function memoryStorage(): SightingsStorage & {
  all(): Sighting[];
  clear(): void;
} {
  const rows: Sighting[] = [];

  const top = <K extends keyof Sighting>(
    subset: Sighting[],
    key: K,
    limit: number
  ): Array<{ value: string; views: number }> => {
    const counts = new Map<string, number>();
    for (const row of subset) {
      const value = row[key];
      if (typeof value !== 'string' || !value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return [...counts]
      .map(([value, views]) => ({ value, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  };

  return {
    all: () => [...rows],
    clear: () => {
      rows.length = 0;
    },
    record(sighting) {
      rows.push(sighting);
    },
    async summary(range) {
      const limit = range.limit ?? 10;
      const subset = rows.filter(
        (row) =>
          row.createdAt >= range.from &&
          row.createdAt <= range.to &&
          (range.bot === undefined || row.bot === range.bot)
      );

      return {
        views: subset.length,
        visitors: new Set(
          subset.map((row) => row.visitor).filter((id): id is string => !!id)
        ).size,
        paths: top(subset, 'path', limit).map(({ value, views }) => ({
          path: value,
          views
        })),
        referrers: top(subset, 'referrer', limit).map(({ value, views }) => ({
          referrer: value,
          views
        })),
        crawlers: top(subset, 'botName', limit).map(({ value, views }) => ({
          botName: value,
          views
        }))
      };
    }
  };
}
