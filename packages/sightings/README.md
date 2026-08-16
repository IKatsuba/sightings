# sightings

Cookieless pageview analytics that counts humans and AI crawlers, in your own database.

```bash
npm install sightings
```

```ts
import { sightings, memoryStorage } from 'sightings';

export const analytics = sightings({
  secret: process.env.SIGHTINGS_SECRET,
  storage: memoryStorage(),
  redact: { dropPaths: ['/admin', '/invite'] }
});

// Any framework that speaks Request/Response:
export const POST = analytics.handler;
```

The core is dependency-light and runs wherever `Request`/`Response` and Web Crypto exist — Node, Deno, Bun, Vercel Edge, Cloudflare Workers.

Subpath exports: `sightings/beacon` (the browser half, no server code pulled in), `sightings/crawlers`, `sightings/redact`, `sightings/storage`.

Full documentation, the Next.js quick start and the honest note about what the visitor hash does and does not guarantee: <https://github.com/IKatsuba/sightings>

MIT © Igor Katsuba
