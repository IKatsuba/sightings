# @sightings/next

Next.js integration for [`sightings`](https://github.com/IKatsuba/sightings) — the route handler, the App Router beacon, and the middleware that counts crawlers a beacon structurally cannot see.

```bash
npm install sightings @sightings/next
```

```ts
// app/api/pv/[[...sightings]]/route.ts
export const { POST } = toNextJsHandler(analytics);
```

```tsx
// app/layout.tsx
<Sightings redact={{ dropPaths: ['/admin', '/invite'] }} />
```

```ts
// middleware.ts
export const middleware = createSightingsMiddleware();
export const config = { matcher: sightingsMatcher };
```

Do not import your `sightings` instance into `middleware.ts` — middleware runs on the edge and a database client does not. `@sightings/next/middleware` reports over HTTP to the route instead, and the route does not trust it.

Full quick start: <https://github.com/IKatsuba/sightings>

MIT © Igor Katsuba
