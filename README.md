# sightings

Cookieless pageview analytics that counts **humans and AI crawlers**, stores the rows in **your own database**, and never writes a custom event.

A row is a _sighting_ — an observation that a visit happened, not a record of who made it. That is the whole design, and the name is there to keep it honest.

```ts
import { sightings } from 'sightings';
import { prismaAdapter } from '@sightings/prisma';

export const analytics = sightings({
  secret: process.env.SIGHTINGS_SECRET,
  storage: prismaAdapter(db),
  redact: { dropPaths: ['/admin', '/invite'] }
});
```

## Why another analytics library

Because the two halves of your traffic need two different mechanisms, and most tools only ship one.

**People** are counted by a beacon: one `sendBeacon` per navigation, nothing written to the device and nothing read back. No cookie, no `localStorage`, no fingerprint. Visitors are told apart by a salted hash the _server_ derives from the request, which rotates every day.

**Crawlers and AI agents** never run that beacon, and their requests are usually served straight from the CDN cache — so no route handler and no server component sees them either. They are counted in middleware, from the document request itself, and stored by family name (`gptbot`, `claudebot`, `perplexitybot`, `telegram-preview`, …) rather than by user agent. In 2026 that half is not a footnote: it is how you find out whether the models that answer questions about your product have actually read it.

And **what it refuses to do** is as much of the point. There are no custom events. A custom event carries an arbitrary payload, and an arbitrary payload is how cookieless aggregates quietly turn into personal data — at which point every privacy page you wrote becomes false. The beacon body is `{ url, referrer }`, validated strictly: an extra field is a `400`, not a new metric.

## Install

```bash
npm install sightings
# plus the integrations you need
npm install @sightings/next @sightings/prisma
```

| Package             | What it is                                                      |
| ------------------- | --------------------------------------------------------------- |
| `sightings`         | Core: redaction, visitor hash, crawler classification, handler  |
| `@sightings/next`   | Next.js route handler, App Router beacon, crawler middleware    |
| `@sightings/prisma` | Prisma storage adapter, plus the model to copy into your schema |

The core is dependency-light and runs anywhere `Request`/`Response` and Web Crypto exist — Node, Deno, Bun, Vercel Edge, Cloudflare Workers.

## Quick start with Next.js

**1. Add the table.** Copy the model from [`@sightings/prisma`](./packages/prisma/prisma/sighting.prisma) into your `schema.prisma` and migrate. Not using Prisma? The same table as plain SQL is [here](./packages/prisma/prisma/sighting.sql), and writing an adapter is one method.

**2. Create the instance.**

```ts
// lib/analytics.ts
import { sightings } from 'sightings';
import { prismaAdapter } from '@sightings/prisma';
import { db } from './db';

export const analytics = sightings({
  secret: process.env.SIGHTINGS_SECRET,
  storage: prismaAdapter(db),
  // Paths whose *url* is the identifier. Everything else goes through the
  // query-parameter allowlist, so a parameter nobody thought about fails closed.
  redact: { dropPaths: ['/admin', '/invite'] },
  onError: (error) => console.error('[sightings]', error)
});
```

`secret` is any random 32+ byte string. Without it nothing is recorded and the endpoint answers `503` — recording is off rather than unsalted, so an empty table reads as a missing secret and not as zero visitors.

**3. Mount the handler.**

```ts
// app/api/pv/[[...sightings]]/route.ts
import { toNextJsHandler } from '@sightings/next';
import { analytics } from '@/lib/analytics';

export const { POST } = toNextJsHandler(analytics);
```

The optional catch-all lets one file serve both `/api/pv` (people) and `/api/pv/bot` (crawlers). Keep the path unremarkable: `/api/analytics` and `/api/track`-shaped names sit in ad-blocker filter lists, and a blocked beacon undercounts exactly the privacy-conscious part of your audience.

**4. Add the beacon.**

```tsx
// app/layout.tsx
import { Sightings } from '@sightings/next/client';

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Sightings redact={{ dropPaths: ['/admin', '/invite'] }} />
      </body>
    </html>
  );
}
```

Mirror the server's `redact` here. The server pass is the one your privacy page rests on — the endpoint is open HTTP, so it cannot assume the client ran — but this pass is what keeps an identifier from leaving the device at all.

**5. Count the crawlers.**

```ts
// middleware.ts
import {
  createSightingsMiddleware,
  sightingsMatcher
} from '@sightings/next/middleware';

export const middleware = createSightingsMiddleware();
export const config = { matcher: sightingsMatcher };
```

Already have middleware? Call `trackCrawler(request, event)` inside it instead. **Do not import your `sightings` instance there** — middleware runs on the edge and a database client does not, which is why this reports over HTTP to the route you just mounted. The route re-classifies the user agent anyway and refuses a human one, so it is not a side door into human counts.

## What a row holds

| Column                         | What it is                                               |
| ------------------------------ | -------------------------------------------------------- |
| `path`                         | Pathname of the redacted url. The query never lands here |
| `referrer`                     | External referrer **host** only, never a full url        |
| `utmSource` … `utmTerm`, `ref` | Campaign tags — the allowlisted query parameters         |
| `visitor`                      | Daily-rotating hash. `null` on crawler rows              |
| `country`                      | Whatever coarse code your edge already derived           |
| `bot`, `botName`               | Crawler family, never the raw user agent                 |
| `createdAt`                    | When                                                     |

No IP. No user agent. No cookie or device id. No event payload.

## The honest part

`visitor` is **pseudonymous, not anonymous**, and a library that blurs that distinction is lying to you.

The hash is sha256 over (secret, UTC day, IP, user agent), truncated to 128 bits. It does not run backwards: no stored row turns back into an IP, and the IP itself is never written. But it can be recomputed _forward_ — if your app stores a known person's IP and user agent anywhere (a session table, a request log), then joining that person to their rows is arithmetic, not cryptography.

So the guarantee that matters is one your code has to keep: **never join `visitor` to a user**, by hash, by timestamp proximity, or by anything else. Aggregate attribution needs none of it — the campaign columns plus daily counts answer "which channel converts" without naming anyone. If you ever want per-person attribution, that is not a query to write: it is a rewrite of your privacy policy and a consent banner, in that order.

Rotating `secret` breaks visitor continuity on purpose. It is the kill switch for the entire linkage.

## Reading the data

Most people query the table with SQL and never call the library back. If you would rather not:

```ts
const summary = await analytics.api.summary({
  from: new Date('2026-08-01'),
  to: new Date('2026-09-01'),
  bot: false // omit for both, true for crawlers only
});
// { views, visitors, paths: [...], referrers: [...], crawlers: [...] }
```

`bot` defaults to _both_. Forgetting to filter it is the one way this table inflates a launch metric.

## Recording without HTTP

The instance records directly too — useful for server-side rendering, a non-HTTP framework, or backfills:

```ts
await analytics.api.pageview({ url, ip, userAgent, referrer, country });
await analytics.api.crawler({ url, userAgent });
```

## Writing a storage adapter

One required method:

```ts
import type { SightingsStorage } from 'sightings';

export const myStorage: SightingsStorage = {
  async record(sighting) {
    await myDb.insert('sightings', sighting);
  },
  // Optional. Without it, `api.summary()` throws a readable error instead of
  // pretending the adapter can read.
  async summary(range) {
    /* … */
  }
};
```

`memoryStorage()` ships with the core for tests and local development.

## Configuration

| Option               | Default                                  | Notes                                       |
| -------------------- | ---------------------------------------- | ------------------------------------------- |
| `secret`             | —                                        | No secret, no recording (`503`)             |
| `storage`            | —                                        | Required                                    |
| `basePath`           | `/api/pv`                                | Must match the beacon and the middleware    |
| `redact.dropPaths`   | `[]`                                     | Subtrees whose path is itself an identifier |
| `redact.allowParams` | `utm_*`, `ref`                           | An allowlist. Keep it one                   |
| `crawlers`           | `isbot` + a named family list            | `extraFamilies` to name your own            |
| `visitorWindow`      | `daily`                                  | Or `hourly`, for a shorter-lived hash       |
| `ipHeaders`          | `x-real-ip`, `x-forwarded-for`           | First value wins                            |
| `countryHeaders`     | `x-vercel-ip-country`, `cf-ipcountry`, … | First value wins                            |
| `onError`            | swallow                                  | Pass a logger in production                 |

## Development

```bash
pnpm install
pnpm test           # vitest, against source
pnpm typecheck
pnpm build          # tsdown → ESM + CJS + types
pnpm check:package  # publint + are-the-types-wrong, on the built packages
```

## Releasing

Changes that users would notice need a changeset:

```bash
pnpm changeset
```

The three packages are versioned in lockstep — an integration is written against a specific core API, so one version number that means the same thing everywhere is worth more than three tight ones.

Merging to `main` opens a release PR collecting the pending changesets into version bumps and changelogs. Merging that PR publishes to npm from CI, with [provenance](https://docs.npmjs.com/generating-provenance-statements) — every published tarball carries a signed link back to the commit and the workflow run that built it.

## License

MIT © Igor Katsuba
