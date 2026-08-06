/**
 * scripts/backfill-storage-emulator.ts — closes a pre-existing, already-
 * flagged gap between scripts/seed.ts and the real image pipeline (the
 * gap scripts/seed-search-5k.ts's own header comment names explicitly:
 * "several [of the fixed ~20 seed listings] reference Firebase Storage
 * images that don't resolve against this local dev environment's storage
 * bucket — a full rebuild throws before ever reaching the bench
 * documents").
 *
 * scripts/seed.ts inserts property_images rows straight into Postgres —
 * it never runs a real photo through services/images/process-image.ts's
 * actual upload pipeline, so no bytes exist at the variant paths
 * mapListingToSearchDocument (search indexing, scripts/reindex-local.ts)
 * and attachImageUrls (the public `/property/{slug}` detail page) both
 * compute from domain/image-storage-path.ts's `variantImagePath` and read
 * via `ImageStorage.publicUrl()` — a real network call that 404s for an
 * object that was never written.
 *
 * For every property_images row belonging to a published/under_offer
 * listing (the two indexable/publicly-visible statuses,
 * services/search/map-listing-to-search-document.ts's
 * INDEXABLE_STATUSES), this uploads a tiny real image to every (width,
 * format) variant path domain/image-variant-plan.ts's planImageVariants
 * would have produced for that row's stored `width` — the exact path
 * scheme both real read paths above use. Local-dev only: requires the
 * Firebase Storage emulator running (`firebase emulators:start --only
 * storage --project my-shop-cdeac`, firebase.json at the repo root) and
 * FIREBASE_STORAGE_EMULATOR_HOST set — FirebaseStorageAdapter.put()
 * refuses to touch a real bucket implicitly, but this script doesn't
 * re-assert that itself; a missing emulator just fails every `put()`
 * call the same way any other real-bucket-unavailable error would.
 *
 * Idempotent: re-running simply overwrites the same objects with the
 * same placeholder bytes.
 *
 * Usage:
 *   firebase emulators:start --only storage --project my-shop-cdeac &
 *   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 pnpm backfill:storage-emulator
 */

import { eq, inArray } from 'drizzle-orm'
import sharp from 'sharp'

import { getDb, schema } from '@/adapters/drizzle'
import { FirebaseStorageAdapter } from '@/adapters/firebase'
import { variantImagePath } from '@/domain/image-storage-path'
import { planImageVariants } from '@/domain/image-variant-plan'

const PLACEHOLDER_WIDTH = 8
const PLACEHOLDER_HEIGHT = 6
const PLACEHOLDER_COLOUR = { r: 178, g: 148, b: 116 }

function assertDatabaseUrlSet(): void {
  if (!process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. Point it at a local Postgres+PostGIS ' +
        'instance (see .env.example) before running this script.',
    )
    process.exit(1)
  }
}

async function main(): Promise<void> {
  assertDatabaseUrlSet()

  const db = getDb()
  const storage = new FirebaseStorageAdapter()

  const rows = await db
    .select({
      id: schema.propertyImages.id,
      propertyId: schema.propertyImages.propertyId,
      width: schema.propertyImages.width,
    })
    .from(schema.propertyImages)
    .innerJoin(
      schema.properties,
      eq(schema.propertyImages.propertyId, schema.properties.id),
    )
    .where(inArray(schema.properties.status, ['published', 'under_offer']))

  console.log(`Found ${rows.length} property_images row(s) to backfill.`)

  const placeholder = {
    create: {
      width: PLACEHOLDER_WIDTH,
      height: PLACEHOLDER_HEIGHT,
      channels: 3 as const,
      background: PLACEHOLDER_COLOUR,
    },
  }
  const webpBuffer = await sharp(placeholder).webp().toBuffer()
  const avifBuffer = await sharp(placeholder).avif().toBuffer()

  let written = 0
  for (const row of rows) {
    for (const { width, format } of planImageVariants(row.width)) {
      const path = variantImagePath(row.propertyId, row.id, width, format)
      await storage.put(
        path,
        format === 'webp' ? webpBuffer : avifBuffer,
        `image/${format}`,
      )
      written += 1
    }
  }

  console.log(`Wrote ${written} variant object(s) to the storage emulator.`)
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('scripts/backfill-storage-emulator.ts failed:', error)
    process.exit(1)
  })
