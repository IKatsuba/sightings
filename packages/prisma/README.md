# @sightings/prisma

Prisma storage adapter for [`sightings`](https://github.com/IKatsuba/sightings).

```bash
npm install sightings @sightings/prisma
```

```ts
import { sightings } from 'sightings';
import { prismaAdapter } from '@sightings/prisma';

const analytics = sightings({
  secret: process.env.SIGHTINGS_SECRET,
  storage: prismaAdapter(db)
});
```

Copy `prisma/sighting.prisma` from this package into your schema and migrate, or point the adapter at a table you already have with `prismaAdapter(db, { model: 'pageView' })` — the column names are the contract, the model name is not. The same table as plain SQL is in `prisma/sighting.sql`.

Full documentation: <https://github.com/IKatsuba/sightings>

MIT © Igor Katsuba
