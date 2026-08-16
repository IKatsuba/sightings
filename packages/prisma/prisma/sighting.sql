-- The same table, for anyone not using Prisma migrate.
CREATE TABLE "Sighting" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "ref" TEXT,
    "visitor" TEXT,
    "country" TEXT,
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "botName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sighting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sighting_createdAt_idx" ON "Sighting"("createdAt");
CREATE INDEX "Sighting_path_createdAt_idx" ON "Sighting"("path", "createdAt");
