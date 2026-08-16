import type {
  Sighting,
  SightingsStorage,
  SightingsSummary,
  SummaryRange
} from 'sightings';

/**
 * Prisma storage for sightings.
 *
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * import { prismaAdapter } from '@sightings/prisma';
 *
 * const analytics = sightings({ secret, storage: prismaAdapter(new PrismaClient()) });
 * ```
 *
 * Add the model from `prisma/sighting.prisma` in this package to your schema,
 * or point `model` at a table you already have — the column names are the
 * contract, not the model name.
 */

/** The slice of a Prisma delegate this adapter uses. */
type Delegate = {
  create(args: { data: Sighting }): Promise<unknown>;
  count(args: { where: Where }): Promise<number>;
  groupBy(
    args: Record<string, unknown>
  ): Promise<Array<Record<string, unknown>>>;
};

type Where = Record<string, unknown>;

export type PrismaAdapterOptions = {
  /** Model name on the client. Defaults to `sighting`. */
  model?: string;
};

type CountedBy<K extends string> = Record<K, string | null> & {
  _count: { _all: number };
};

function delegateOf(client: unknown, model: string): Delegate {
  const delegate = (client as Record<string, unknown> | null)?.[model];

  if (!delegate || typeof (delegate as Delegate).create !== 'function') {
    throw new Error(
      `@sightings/prisma: the client has no \`${model}\` model. Add the model from prisma/sighting.prisma, or pass { model: '<yourModel>' }.`
    );
  }

  return delegate as Delegate;
}

function rangeWhere(range: SummaryRange): Where {
  return {
    createdAt: { gte: range.from, lte: range.to },
    ...(range.bot === undefined ? {} : { bot: range.bot })
  };
}

export function prismaAdapter(
  client: unknown,
  options: PrismaAdapterOptions = {}
): SightingsStorage {
  const model = options.model ?? 'sighting';

  const topBy = async <K extends string>(
    key: K,
    where: Where,
    limit: number
  ): Promise<Array<{ value: string; views: number }>> => {
    const rows = (await delegateOf(client, model).groupBy({
      by: [key],
      where: { ...where, [key]: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { [key]: 'desc' } },
      take: limit
    })) as Array<CountedBy<K>>;

    return rows
      .filter(
        (row): row is CountedBy<K> & Record<K, string> => row[key] !== null
      )
      .map((row) => ({ value: row[key], views: row._count._all }));
  };

  return {
    async record(sighting: Sighting) {
      await delegateOf(client, model).create({ data: sighting });
    },

    async summary(range: SummaryRange): Promise<SightingsSummary> {
      const limit = range.limit ?? 10;
      const where = rangeWhere(range);

      const [views, visitors, paths, referrers, crawlers] = await Promise.all([
        delegateOf(client, model).count({ where }),
        // Prisma has no `count distinct`, so the distinct hashes come back as
        // group keys. Fine at the traffic a self-hosted counter sees; if this
        // table ever gets big, replace it with one raw query.
        delegateOf(client, model).groupBy({
          by: ['visitor'],
          where: { ...where, visitor: { not: null } }
        }),
        topBy('path', where, limit),
        topBy('referrer', where, limit),
        topBy('botName', where, limit)
      ]);

      return {
        views,
        visitors: visitors.length,
        paths: paths.map(({ value, views }) => ({ path: value, views })),
        referrers: referrers.map(({ value, views }) => ({
          referrer: value,
          views
        })),
        crawlers: crawlers.map(({ value, views }) => ({
          botName: value,
          views
        }))
      };
    }
  };
}
