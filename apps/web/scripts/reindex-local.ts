/**
 * scripts/reindex-local.ts — a local-dev convenience wrapper around the
 * exact same use case GET /api/cron/reindex calls
 * (services/search-sync/rebuild-search-index.ts's RebuildSearchIndex),
 * for populating a local Meilisearch daemon from the seeded dev database
 * without standing up a signed cron request (isAuthorizedCronRequest
 * needs CRON_SECRET or NODE_ENV=production).
 *
 * Requires FIREBASE_STORAGE_EMULATOR_HOST to be set (see
 * scripts/backfill-storage-emulator.ts's own header comment for why): a
 * full reindex maps EVERY indexable listing via
 * mapListingToSearchDocument, which resolves each cover photo's public
 * URL through ImageStorage.publicUrl() — a real network call. Without an
 * object actually present at that path (either the real bucket, unusable
 * here per docs/PRD.md/MEMORY's "no billing account" note, or the
 * Storage emulator backfilled by that script), this throws for the first
 * listing with any images and the whole reindex aborts (Promise.all
 * semantics) — the pre-existing gap scripts/seed-search-5k.ts's own
 * header comment already flags as "a separate, worth-fixing issue."
 *
 * Usage:
 *   firebase emulators:start --only storage --project my-shop-cdeac &
 *   pnpm tsx scripts/backfill-storage-emulator.ts
 *   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 pnpm reindex:local
 *
 * No live database/Meilisearch on this development machine to run this
 * against without manual local setup (same caveat as
 * scripts/search-bench.ts) — this file's own shape is covered by
 * `pnpm typecheck`, not a dedicated test.
 */

import { createServices } from '@/lib/composition'

function assertDatabaseUrlSet(): void {
  if (!process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. Point it at a local Postgres+PostGIS ' +
        'instance (see .env.example) before running this script.',
    )
    process.exit(1)
  }
}

function assertMeilisearchHostSet(): void {
  if (!process.env.MEILISEARCH_HOST) {
    console.error(
      'MEILISEARCH_HOST is not set. Point it at a local Meilisearch ' +
        'daemon (see .env.example) before running this script.',
    )
    process.exit(1)
  }
}

async function main(): Promise<void> {
  assertDatabaseUrlSet()
  assertMeilisearchHostSet()

  const { searchSync } = createServices()
  const result = await searchSync.rebuildSearchIndex.execute()

  console.log(
    `Indexed ${result.indexed} listing(s). ` +
      `Postgres: ${result.drift.postgresCount}, ` +
      `Meilisearch before: ${result.drift.meiliCountBefore}, ` +
      `Meilisearch after: ${result.drift.meiliCountAfter}.`,
  )

  if (result.drift.postgresCount !== result.drift.meiliCountAfter) {
    console.warn(
      'Count mismatch — see RebuildSearchIndex.execute’s own console.warn above.',
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('scripts/reindex-local.ts failed:', error)
    process.exit(1)
  })
