import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleListingRepository } from '@/adapters/drizzle/repositories/listing-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import * as schema from '@/adapters/drizzle/schema'
import { events, outbox } from '@/adapters/drizzle/schema'
import type { NewListingDraft } from '@/ports/listing-repository'
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
  },
)
