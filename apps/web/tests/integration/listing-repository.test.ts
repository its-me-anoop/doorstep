import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleListingRepository } from '@/adapters/drizzle/repositories/listing-repository'
import { DrizzlePropertyImageRepository } from '@/adapters/drizzle/repositories/property-image-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import * as schema from '@/adapters/drizzle/schema'
import { events, outbox } from '@/adapters/drizzle/schema'
import {
  ListingNotFoundError,
  type NewListingDraft,
} from '@/ports/listing-repository'
import type { NewPropertyImage } from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'

// Exercises DrizzleListingRepository against a real Postgres+PostGIS
// instance, running the actual migrations in
// src/adapters/drizzle/migrations — same rationale and skip condition as
// tests/integration/db.schema.test.ts and agency-repository.test.ts (no
// Docker/live database on this development machine; runs for real in
// CI's postgis service container, PRD §8.8).
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(
  dirname,
  '../../src/adapters/drizzle/migrations',
)

describe.skipIf(!TEST_DATABASE_URL)(
  'DrizzleListingRepository (live database)',
  () => {
    let client: ReturnType<typeof postgres>
    let db: ReturnType<typeof drizzle<typeof schema>>
    let listingRepository: DrizzleListingRepository
    let lister: User

    beforeAll(async () => {
      client = postgres(TEST_DATABASE_URL as string, { max: 1 })
      db = drizzle(client, { schema })
      await migrate(db, { migrationsFolder })
      listingRepository = new DrizzleListingRepository(db)
    })

    afterAll(async () => {
      await client.end()
    })

    beforeEach(async () => {
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
        features: ['Garden', 'Garage'],
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

    it('creates a draft and reads it back by id and by slug, including location and array fields', async () => {
      const created = await listingRepository.createDraft(draft())

      expect(created.id).toBeTruthy()
      expect(created.status).toBe('draft')
      expect(created.listerId).toBe(lister.id)
      expect(created.location).toEqual({ lat: 51.4543, lng: -0.9781 })
      expect(created.features).toEqual(['Garden', 'Garage'])
      expect(created.publishedAt).toBeNull()
      expect(created.statusChangedAt).toBeNull()

      const byId = await listingRepository.findById(created.id)
      expect(byId).toEqual(created)

      const bySlug = await listingRepository.findBySlug(created.slug)
      expect(bySlug).toEqual(created)
    })

    it('returns null for an unknown id and an unknown slug', async () => {
      expect(await listingRepository.findById(crypto.randomUUID())).toBeNull()
      expect(await listingRepository.findBySlug('no-such-listing')).toBeNull()
    })

    it('rejects a listing whose listerId does not reference an existing user (FK violation surfaces)', async () => {
      await expect(
        listingRepository.createDraft(draft({ listerId: crypto.randomUUID() })),
      ).rejects.toThrow()
    })

    it('plain update() changes fields without writing an outbox row', async () => {
      const created = await listingRepository.createDraft(draft())

      const updated = await listingRepository.update(created.id, {
        description: 'Updated description.',
        price: 260_000,
      })

      expect(updated.description).toBe('Updated description.')
      expect(updated.price).toBe(260_000)

      const outboxRows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.propertyId, created.id))
      expect(outboxRows).toHaveLength(0)
    })

    it('updateWithSideEffects writes the field update and the outbox row atomically', async () => {
      const created = await listingRepository.createDraft(draft())

      const updated = await listingRepository.updateWithSideEffects(
        created.id,
        { description: 'Refreshed copy.' },
        { outboxUpsert: true },
      )

      expect(updated.description).toBe('Refreshed copy.')

      const outboxRows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.propertyId, created.id))
      expect(outboxRows).toHaveLength(1)
      expect(outboxRows[0]?.op).toBe('upsert')
    })

    it('updateWithSideEffects writes a listing_price_changed events row when a price change is supplied', async () => {
      const created = await listingRepository.createDraft(
        draft({ price: 250_000 }),
      )

      await listingRepository.updateWithSideEffects(
        created.id,
        { price: 275_000 },
        {
          outboxUpsert: true,
          priceChangeEvent: { previous: 250_000, next: 275_000 },
        },
      )

      const eventRows = await db
        .select()
        .from(events)
        .where(eq(events.name, 'listing_price_changed'))
      const forThisListing = eventRows.filter(
        (row) =>
          (row.properties as { propertyId?: string }).propertyId === created.id,
      )
      expect(forThisListing).toHaveLength(1)
      expect(forThisListing[0]?.properties).toEqual({
        propertyId: created.id,
        previous: 250_000,
        next: 275_000,
        channel: 'sale',
      })
    })

    it('transitionWithOutbox moves status and writes the outbox row atomically (upsert)', async () => {
      const created = await listingRepository.createDraft(draft())
      const statusChangedAt = new Date('2026-02-01T12:00:00Z')

      const transitioned = await listingRepository.transitionWithOutbox(
        created.id,
        'pending_review',
        { statusChangedAt, outboxOp: null },
      )
      expect(transitioned.status).toBe('pending_review')

      const published = await listingRepository.transitionWithOutbox(
        created.id,
        'published',
        {
          statusChangedAt,
          publishedAt: statusChangedAt,
          outboxOp: 'upsert',
        },
      )

      expect(published.status).toBe('published')
      expect(published.statusChangedAt).toEqual(statusChangedAt)
      expect(published.publishedAt).toEqual(statusChangedAt)

      const outboxRows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.propertyId, created.id))
      expect(outboxRows).toHaveLength(1)
      expect(outboxRows[0]?.op).toBe('upsert')
    })

    it('transitionWithOutbox writes a delete outbox row when hiding a published listing', async () => {
      const created = await listingRepository.createDraft(draft())
      const now = new Date('2026-02-01T12:00:00Z')
      await listingRepository.transitionWithOutbox(
        created.id,
        'pending_review',
        {
          statusChangedAt: now,
          outboxOp: null,
        },
      )
      await listingRepository.transitionWithOutbox(created.id, 'published', {
        statusChangedAt: now,
        publishedAt: now,
        outboxOp: 'upsert',
      })

      await listingRepository.transitionWithOutbox(created.id, 'hidden', {
        statusChangedAt: now,
        outboxOp: 'delete',
      })

      const outboxRows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.propertyId, created.id))
      expect(outboxRows.map((row) => row.op)).toEqual(['upsert', 'delete'])
    })

    it('transitionWithOutbox writes no outbox row when outboxOp is null', async () => {
      const created = await listingRepository.createDraft(draft())

      await listingRepository.transitionWithOutbox(
        created.id,
        'pending_review',
        {
          statusChangedAt: new Date(),
          outboxOp: null,
        },
      )

      const outboxRows = await db
        .select()
        .from(outbox)
        .where(eq(outbox.propertyId, created.id))
      expect(outboxRows).toHaveLength(0)
    })

    it('delete() removes the row outright — findById returns null afterwards', async () => {
      const created = await listingRepository.createDraft(draft())

      await listingRepository.delete(created.id)

      expect(await listingRepository.findById(created.id)).toBeNull()
    })

    it('delete() cascade-deletes the listing’s property_images rows (schema-level onDelete: cascade)', async () => {
      const created = await listingRepository.createDraft(draft())
      const propertyImageRepository = new DrizzlePropertyImageRepository(db)
      const image: NewPropertyImage = {
        id: crypto.randomUUID(),
        propertyId: created.id,
        kind: 'photo',
        storagePath: `listings/${created.id}/original/${crypto.randomUUID()}`,
        position: 0,
        width: 1600,
        height: 1200,
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        altText: null,
      }
      await propertyImageRepository.create(image)

      await listingRepository.delete(created.id)

      expect(await propertyImageRepository.findById(image.id)).toBeNull()
    })

    it('delete() throws ListingNotFoundError for an unknown id', async () => {
      await expect(
        listingRepository.delete(crypto.randomUUID()),
      ).rejects.toThrow(ListingNotFoundError)
    })

    it('paginates listByLister newest-first with a working cursor (id is a time-ordered UUID v7)', async () => {
      const created = []
      // Deliberately sequential (not Promise.all) so each draft's uuidv7 id
      // sorts strictly after the last, matching real request-by-request
      // creation order.
      for (let i = 0; i < 5; i += 1) {
        created.push(await listingRepository.createDraft(draft()))
      }
      const expectedNewestFirst = [...created].reverse().map((l) => l.id)

      const firstPage = await listingRepository.listByLister(lister.id, {
        limit: 2,
      })
      expect(firstPage.data.map((l) => l.id)).toEqual(
        expectedNewestFirst.slice(0, 2),
      )
      expect(firstPage.nextCursor).toBe(expectedNewestFirst[1])

      const secondPage = await listingRepository.listByLister(lister.id, {
        limit: 2,
        cursor: firstPage.nextCursor,
      })
      expect(secondPage.data.map((l) => l.id)).toEqual(
        expectedNewestFirst.slice(2, 4),
      )
      expect(secondPage.nextCursor).toBe(expectedNewestFirst[3])

      const thirdPage = await listingRepository.listByLister(lister.id, {
        limit: 2,
        cursor: secondPage.nextCursor,
      })
      expect(thirdPage.data.map((l) => l.id)).toEqual(
        expectedNewestFirst.slice(4, 5),
      )
      expect(thirdPage.nextCursor).toBeNull()
    })

    it('listByLister only returns the given lister’s own listings', async () => {
      const otherLister = await new DrizzleUserRepository(db).create({
        firebaseUid: `firebase-${crypto.randomUUID()}`,
        email: `other-lister-${crypto.randomUUID()}@example.co.uk`,
        displayName: 'Other Lister',
        role: 'owner',
        agencyId: null,
        status: 'active',
      })
      const mine = await listingRepository.createDraft(draft())
      await listingRepository.createDraft(
        draft({
          listerId: otherLister.id,
          slug: `other-${crypto.randomUUID()}`,
        }),
      )

      const page = await listingRepository.listByLister(lister.id)

      expect(page.data.map((l) => l.id)).toEqual([mine.id])
    })

    describe('listIndexable / countIndexable', () => {
      /** Moves a freshly created draft straight to `status`, bypassing the
       * domain state machine entirely — transitionWithOutbox itself does
       * not validate transitions (see this repository's doc comment), so
       * this is the same "insert a published listing directly through the
       * repo" shortcut scripts/seed.ts's own insert takes, just via the
       * repository instead of a second raw insert path. */
      async function createAt(
        status: 'published' | 'under_offer' | 'hidden' | 'pending_review',
        overrides: Partial<NewListingDraft> = {},
      ) {
        const created = await listingRepository.createDraft(draft(overrides))
        const statusChangedAt = new Date()
        return listingRepository.transitionWithOutbox(created.id, status, {
          statusChangedAt,
          publishedAt: statusChangedAt,
          outboxOp: null,
        })
      }

      it('returns only published/under_offer listings, excluding every other status', async () => {
        // Not scoped to "this test's own rows" — listIndexable() is a
        // whole-table scan by design (services/search-sync/
        // rebuild-search-index.ts's nightly job has no lister/agency to
        // filter by) — so this asserts inclusion/exclusion rather than an
        // exact-equals against a table this suite doesn't otherwise clean
        // between tests (see this directory's other suites' own
        // accumulated fixtures on a shared dev database).
        const published = await createAt('published')
        const underOffer = await createAt('under_offer')
        const pendingReview = await createAt('pending_review')
        const hidden = await createAt('hidden')

        const ids = (await listingRepository.listIndexable()).data.map(
          (l) => l.id,
        )

        expect(ids).toEqual(
          expect.arrayContaining([published.id, underOffer.id]),
        )
        expect(ids).not.toContain(pendingReview.id)
        expect(ids).not.toContain(hidden.id)
      })

      // Cursor pagination mechanics (newest-first ordering, page-size
      // limits, cursor correctness) are the shared private `listBy` helper
      // listByLister's own suite already proves exhaustively — scoped to
      // one lister there, so immune to the cross-test timing interference
      // a whole-table, unscoped query like this one has no way to avoid.
      // listIndexable's own thing to prove is the status filter, covered
      // above.

      it('counts only published/under_offer listings', async () => {
        await createAt('published')
        await createAt('under_offer')
        await createAt('pending_review')

        expect(await listingRepository.countIndexable()).toBeGreaterThanOrEqual(
          2,
        )
        // Scope-independent of any other listings left in this shared
        // dev/CI database by other tests: prove the delta from one more
        // non-indexable listing is exactly zero, and from one more
        // indexable listing is exactly one.
        const before = await listingRepository.countIndexable()
        await createAt('hidden')
        expect(await listingRepository.countIndexable()).toBe(before)
        await createAt('published')
        expect(await listingRepository.countIndexable()).toBe(before + 1)
      })
    })
  },
)
