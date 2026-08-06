import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleListingRepository } from '@/adapters/drizzle/repositories/listing-repository'
import { DrizzleOutboxRepository } from '@/adapters/drizzle/repositories/outbox-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import * as schema from '@/adapters/drizzle/schema'
import { outbox } from '@/adapters/drizzle/schema'
import type { NewListingDraft } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'

// Exercises DrizzleOutboxRepository against a real Postgres instance —
// same rationale and skip condition as this directory's other suites (no
// Docker/live database on this development machine; runs for real in
// CI's postgis service container, PRD §8.8). `max: 5` (unlike this
// directory's other suites' `max: 1`) is deliberate here: the "two
// overlapping claimBatch calls never return the same row" test needs two
// genuinely concurrent Postgres connections/transactions, not two calls
// serialised through one pooled connection.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(
  dirname,
  '../../src/adapters/drizzle/migrations',
)

describe.skipIf(!TEST_DATABASE_URL)(
  'DrizzleOutboxRepository (live database)',
  () => {
    let client: ReturnType<typeof postgres>
    let db: ReturnType<typeof drizzle<typeof schema>>
    let listingRepository: DrizzleListingRepository
    let lister: User

    beforeAll(async () => {
      client = postgres(TEST_DATABASE_URL as string, { max: 5 })
      db = drizzle(client, { schema })
      await migrate(db, { migrationsFolder })
      listingRepository = new DrizzleListingRepository(db)
    })

    afterAll(async () => {
      await client.end()
    })

    beforeEach(async () => {
      // claimBatch/countPending operate over the whole table (they have no
      // propertyId to scope by — that's the point, a real drain worker
      // drains everything pending), unlike this directory's other suites'
      // per-test-listing-scoped assertions. Other integration files leave
      // their own outbox rows behind (this DB persists across runs on a
      // dev machine), so this suite needs a clean table per test rather
      // than filtering by id everywhere.
      await db.delete(outbox)

      lister = await new DrizzleUserRepository(db).create({
        firebaseUid: `firebase-${crypto.randomUUID()}`,
        email: `lister-${crypto.randomUUID()}@example.co.uk`,
        displayName: 'Test Lister',
        role: 'owner',
        agencyId: null,
        status: 'active',
      })
    })

    function draft(overrides: Partial<NewListingDraft> = {}): NewListingDraft {
      return {
        listerId: lister.id,
        agencyId: null,
        channel: 'sale',
        propertyType: 'semi_detached',
        title: '3 bed semi-detached house for sale',
        slug: `test-listing-${crypto.randomUUID()}`,
        description: 'A lovely test house.',
        features: [],
        bedrooms: 3,
        bathrooms: 1,
        price: 250_000,
        priceQualifier: 'guide_price',
        tenure: 'freehold',
        deposit: null,
        furnished: null,
        availableFrom: null,
        epcRating: null,
        councilTaxBand: 'C',
        newHome: false,
        addressLine1: '1 Test Street',
        displayAddress: 'Test Street, Reading, RG30',
        town: 'Reading',
        outcode: 'RG30',
        postcode: 'RG30 1AA',
        location: { lat: 51.4543, lng: -0.9781 },
        locationApproximate: false,
        ...overrides,
      }
    }

    /** Seeds `count` outbox rows for `count` freshly-created listings,
     * each enqueued a millisecond apart so `enqueuedAt` ordering is
     * deterministic, returning the outbox row ids in enqueued order. */
    async function seedOutboxRows(count: number): Promise<string[]> {
      const ids: string[] = []
      for (let i = 0; i < count; i += 1) {
        const listing = await listingRepository.createDraft(draft())
        const [row] = await db
          .insert(outbox)
          .values({
            propertyId: listing.id,
            op: 'upsert',
            enqueuedAt: new Date(Date.now() + i),
          })
          .returning()
        ids.push(row!.id)
      }
      return ids
    }

    describe('claimBatch', () => {
      it('claims unprocessed rows oldest-enqueued first, up to the limit', async () => {
        const ids = await seedOutboxRows(3)
        const repository = new DrizzleOutboxRepository(db)

        const claimed = await repository.claimBatch(2)

        expect(claimed.map((e) => e.id)).toEqual(ids.slice(0, 2))
        expect(claimed.every((e) => e.op === 'upsert')).toBe(true)
      })

      it('returns an empty array when nothing is pending', async () => {
        const repository = new DrizzleOutboxRepository(db)
        expect(await repository.claimBatch(10)).toEqual([])
      })

      it('never returns the same row twice while its lease is fresh, even to a second overlapping call', async () => {
        const ids = await seedOutboxRows(10)
        const repositoryA = new DrizzleOutboxRepository(db)
        const repositoryB = new DrizzleOutboxRepository(db)

        const [batchA, batchB] = await Promise.all([
          repositoryA.claimBatch(5),
          repositoryB.claimBatch(5),
        ])

        const claimedIds = [...batchA, ...batchB].map((e) => e.id).sort()
        expect(claimedIds).toEqual([...ids].sort())
        // No id appears in both batches — SKIP LOCKED partitioned them.
        const batchAIds = new Set(batchA.map((e) => e.id))
        expect(batchB.every((e) => !batchAIds.has(e.id))).toBe(true)
      })

      it('excludes an already-claimed row while its lease is still fresh', async () => {
        const [id] = await seedOutboxRows(1)
        // A minute-long lease — comfortably longer than this test takes to
        // run, so the second call below is guaranteed to still see it as
        // fresh.
        const repository = new DrizzleOutboxRepository(db, 60_000)

        const firstClaim = await repository.claimBatch(10)
        expect(firstClaim.map((e) => e.id)).toEqual([id])

        const secondClaim = await repository.claimBatch(10)
        expect(secondClaim).toEqual([])
      })

      it('reclaims a row once its lease has expired (the claiming run is presumed dead)', async () => {
        const [id] = await seedOutboxRows(1)
        // A 1ms lease so a short, real wait afterwards is guaranteed to
        // land past expiry.
        const repository = new DrizzleOutboxRepository(db, 1)

        const firstClaim = await repository.claimBatch(10)
        expect(firstClaim.map((e) => e.id)).toEqual([id])

        await new Promise((resolve) => setTimeout(resolve, 20))

        const secondClaim = await repository.claimBatch(10)
        expect(secondClaim.map((e) => e.id)).toEqual([id])
      })
    })

    describe('markProcessed', () => {
      it('excludes marked rows from future claimBatch calls', async () => {
        await seedOutboxRows(2)
        const repository = new DrizzleOutboxRepository(db)
        const claimed = await repository.claimBatch(10)

        await repository.markProcessed([claimed[0]!.id])

        const rows = await db
          .select()
          .from(outbox)
          .where(eq(outbox.id, claimed[0]!.id))
        expect(rows[0]?.processedAt).not.toBeNull()

        expect(await repository.countPending()).toBe(1)
      })

      it('is a no-op for an unknown id', async () => {
        const repository = new DrizzleOutboxRepository(db)
        await expect(
          repository.markProcessed([crypto.randomUUID()]),
        ).resolves.toBeUndefined()
      })
    })

    describe('countPending', () => {
      it('counts only unprocessed rows', async () => {
        const ids = await seedOutboxRows(3)
        const repository = new DrizzleOutboxRepository(db)
        await repository.markProcessed([ids[0]!])

        expect(await repository.countPending()).toBe(2)
      })
    })
  },
)
