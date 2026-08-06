/**
 * scripts/seed-search-5k.ts — M2 exit-criterion evidence (PRD §13:
 * "Seeded 5k listings; p75 search under 500 ms"). Inserts
 * scripts/search-bench-data.ts's deterministic 5000-listing generator
 * output, all owned by one synthetic bench lister, into Postgres (the
 * drizzle bulk-insert path, in batches), then indexes those SAME rows
 * straight into Meilisearch (the "OR direct reindex after" option from
 * this task's brief) — Postgres stays the source of truth either way.
 *
 * Deliberately upserts only the newly-generated documents rather than
 * calling services/search-sync's shared RebuildSearchIndex (a full
 * clear-and-reindex of every indexable listing in the system): a bench
 * property's ListingSearchDocument is fully derivable from the
 * generator's own output with zero I/O (no images, no agency — every
 * bench property is deliberately image-less, see search-bench-data.ts),
 * so building it directly is both simpler and correct, and (unlike a
 * full RebuildSearchIndex run) never touches this environment's other
 * seeded rows (scripts/seed.ts's fixed 20) at all. RebuildSearchIndex
 * itself now logs-and-skips, rather than throws on, a listing whose
 * image reference doesn't resolve against this local dev environment's
 * storage bucket (see that file's own header comment) — this script's
 * choice to upsert directly is still the right one on its own merits,
 * just no longer a workaround for a bug in the shared use case.
 *
 * Guarded non-prod, same pattern as scripts/seed.ts. Idempotent the same
 * way too: every run first deletes any existing bench rows from BOTH
 * Postgres and Meilisearch (found via the bench lister's known
 * firebase_uid — see search-bench-data.ts's BENCH_LISTER_FIREBASE_UID),
 * so re-running never duplicates rows or leaves stale documents behind.
 *
 * Usage (see this repo's root/apps/web package.json scripts):
 *   pnpm seed:search-5k            seed 5000 (or --count=N) and index them
 *   pnpm seed:search-5k:clean      delete the bench rows from both stores,
 *                                  leaving whatever else is indexed (the
 *                                  fixed ~20-listing seed) untouched
 *
 * There is no live database on this development machine — this script,
 * like scripts/seed.ts, is meant to be run against a real local Postgres
 * + Meilisearch (see the M2 task brief's "RUN IT locally" instructions),
 * not exercised in CI. scripts/search-bench-data.ts's pure generator is
 * unit-tested (tests/unit/scripts/search-bench-data.test.ts); this file's
 * own shape is covered by `pnpm typecheck`.
 */

import { eq } from 'drizzle-orm'

import { getDb, schema } from '@/adapters/drizzle'
import type { Db } from '@/adapters/drizzle'
import { MeilisearchSearchIndex } from '@/adapters/meilisearch'
import type { ListingSearchDocument } from '@/ports/search-index'

import {
  BENCH_LISTER_DISPLAY_NAME,
  BENCH_LISTER_EMAIL,
  BENCH_LISTER_FIREBASE_UID,
  generateBenchProperties,
  type BenchProperty,
} from './search-bench-data'

const { properties, users } = schema

const DEFAULT_COUNT = 5000
const BATCH_SIZE = 500

function assertNotProductionUnlessForced(): void {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== '1') {
    console.error(
      'Refusing to seed with NODE_ENV=production. Set SEED_FORCE=1 if ' +
        'you really mean to run the search bench seed against this database.',
    )
    process.exit(1)
  }
}

function assertDatabaseUrlSet(): void {
  if (!process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. Point it at a local Postgres+PostGIS ' +
        'instance (see .env.example) before running this script.',
    )
    process.exit(1)
  }
}

function parseArgs(): { clean: boolean; count: number } {
  const args = process.argv.slice(2)
  const clean = args.includes('--clean')
  const countArg = args.find((a) => a.startsWith('--count='))
  const count = countArg
    ? Number.parseInt(countArg.slice('--count='.length), 10)
    : DEFAULT_COUNT
  return { clean, count }
}

/** Deletes any existing bench properties from BOTH stores, plus the bench
 * lister user itself — the idempotency step. Returns the deleted
 * properties' ids only so the Meilisearch side can be cleaned up too
 * (Postgres cascades property_images itself; Meilisearch has no such
 * cascade, so those ids must be deleted explicitly). A no-op on a first
 * run (nothing to delete). */
async function deleteBenchRows(
  db: Db,
  searchIndex: MeilisearchSearchIndex,
): Promise<void> {
  const [benchUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, BENCH_LISTER_FIREBASE_UID))

  if (!benchUser) return

  const existing = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.listerId, benchUser.id))

  if (existing.length > 0) {
    await searchIndex.delete(existing.map((row) => row.id))
  }

  await db.delete(properties).where(eq(properties.listerId, benchUser.id))
  await db.delete(users).where(eq(users.id, benchUser.id))
}

async function ensureBenchLister(db: Db): Promise<string> {
  const [inserted] = await db
    .insert(users)
    .values({
      firebaseUid: BENCH_LISTER_FIREBASE_UID,
      email: BENCH_LISTER_EMAIL,
      displayName: BENCH_LISTER_DISPLAY_NAME,
      phone: null,
      role: 'owner',
      agencyId: null,
      status: 'active',
    })
    .returning({ id: users.id })

  if (!inserted) {
    throw new Error('seed-search-5k.ts: failed to insert the bench lister')
  }
  return inserted.id
}

function toPropertyInsertValues(
  property: BenchProperty,
  listerId: string,
): typeof properties.$inferInsert {
  const publishedAt = new Date(property.publishedAt)
  return {
    listerId,
    agencyId: null,
    channel: property.channel,
    status: property.status,
    propertyType: property.propertyType,
    title: property.title,
    slug: property.slug,
    description: property.description,
    features: property.features,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    price: property.price,
    priceQualifier: property.priceQualifier,
    tenure: property.tenure,
    deposit: property.deposit,
    furnished: property.furnished,
    availableFrom: property.availableFrom
      ? new Date(property.availableFrom)
      : null,
    epcRating: property.epcRating,
    councilTaxBand: property.councilTaxBand,
    newHome: property.newHome,
    addressLine1: property.addressLine1,
    displayAddress: property.displayAddress,
    town: property.town,
    outcode: property.outcode,
    postcode: property.postcode,
    location: property.location,
    locationApproximate: property.locationApproximate,
    publishedAt,
    statusChangedAt: publishedAt,
  }
}

/** Every bench property is `published` with no images and no agency —
 * see search-bench-data.ts's header comment — so this needs no
 * ImageStorage/AgencyRepository lookup, unlike
 * services/search/map-listing-to-search-document.ts's general-purpose
 * mapper. `id` comes from Postgres's `.returning()` (uuidv7, server-
 * generated at insert time), everything else straight from the
 * generator's own output. */
function toSearchDocument(
  property: BenchProperty,
  id: string,
): ListingSearchDocument {
  return {
    id,
    slug: property.slug,
    status: property.status,
    channel: property.channel,
    title: property.title,
    displayAddress: property.displayAddress,
    town: property.town,
    outcode: property.outcode,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    price: property.price,
    priceQualifier: property.priceQualifier,
    tenure: property.tenure,
    furnished: property.furnished,
    availableFrom: property.availableFrom,
    newHome: property.newHome,
    features: property.features,
    coverImageUrl: null,
    imageCount: 0,
    agency: null,
    publishedAt: Math.floor(new Date(property.publishedAt).getTime() / 1000),
    _geo: property.location,
  }
}

async function insertAndIndexBenchProperties(
  db: Db,
  searchIndex: MeilisearchSearchIndex,
  listerId: string,
  benchProperties: BenchProperty[],
): Promise<void> {
  for (let start = 0; start < benchProperties.length; start += BATCH_SIZE) {
    const batch = benchProperties.slice(start, start + BATCH_SIZE)
    const inserted = await db
      .insert(properties)
      .values(
        batch.map((property) => toPropertyInsertValues(property, listerId)),
      )
      .returning({ id: properties.id, slug: properties.slug })

    const idBySlug = new Map(inserted.map((row) => [row.slug, row.id]))
    const documents = batch.map((property) => {
      const id = idBySlug.get(property.slug)
      if (!id) {
        throw new Error(
          `seed-search-5k.ts: no inserted row for slug ${property.slug}`,
        )
      }
      return toSearchDocument(property, id)
    })
    await searchIndex.upsert(documents)

    console.log(
      `  inserted + indexed ${Math.min(start + BATCH_SIZE, benchProperties.length)}/${benchProperties.length}`,
    )
  }
}

async function main(): Promise<void> {
  assertNotProductionUnlessForced()
  assertDatabaseUrlSet()

  const { clean, count } = parseArgs()
  const db = getDb()
  const searchIndex = new MeilisearchSearchIndex()
  await searchIndex.ensureSettings()

  console.log(
    'Deleting any existing bench rows from Postgres and Meilisearch...',
  )
  await deleteBenchRows(db, searchIndex)

  if (clean) {
    console.log('Cleaned.')
    return
  }

  console.log(`Generating ${count} deterministic bench properties...`)
  const benchProperties = generateBenchProperties(count)

  console.log('Creating the bench lister...')
  const listerId = await ensureBenchLister(db)

  console.log(
    `Inserting + indexing ${benchProperties.length} properties in batches of ${BATCH_SIZE}...`,
  )
  await insertAndIndexBenchProperties(
    db,
    searchIndex,
    listerId,
    benchProperties,
  )

  console.log(
    `Done. Seeded and indexed ${benchProperties.length} bench properties.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('seed-search-5k.ts failed:', error)
    process.exit(1)
  })
