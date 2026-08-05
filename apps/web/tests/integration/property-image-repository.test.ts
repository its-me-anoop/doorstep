import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleListingRepository } from '@/adapters/drizzle/repositories/listing-repository'
import { DrizzlePropertyImageRepository } from '@/adapters/drizzle/repositories/property-image-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import * as schema from '@/adapters/drizzle/schema'
import type { Listing, NewListingDraft } from '@/ports/listing-repository'
import type { NewPropertyImage } from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'

// Exercises DrizzlePropertyImageRepository against a real Postgres
// instance — same rationale and skip condition as this directory's other
// suites (no Docker/live database on this development machine; runs for
// real in CI's postgis service container, PRD §8.8).
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(
  dirname,
  '../../src/adapters/drizzle/migrations',
)

describe.skipIf(!TEST_DATABASE_URL)(
  'DrizzlePropertyImageRepository (live database)',
  () => {
    let client: ReturnType<typeof postgres>
    let db: ReturnType<typeof drizzle<typeof schema>>
    let imageRepository: DrizzlePropertyImageRepository
    let lister: User
    let listing: Listing

    beforeAll(async () => {
      client = postgres(TEST_DATABASE_URL as string, { max: 1 })
      db = drizzle(client, { schema })
      await migrate(db, { migrationsFolder })
      imageRepository = new DrizzlePropertyImageRepository(db)
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

      const draft: NewListingDraft = {
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
      }
      listing = await new DrizzleListingRepository(db).createDraft(draft)
    })

    function newImage(
      overrides: Partial<NewPropertyImage> = {},
    ): NewPropertyImage {
      return {
        id: crypto.randomUUID(),
        propertyId: listing.id,
        kind: 'photo',
        storagePath: `listings/${listing.id}/original/${crypto.randomUUID()}`,
        position: 0,
        width: 1600,
        height: 1200,
        blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
        altText: null,
        ...overrides,
      }
    }

    it('creates a row with the given id (not server-generated) and reads it back', async () => {
      const image = newImage()

      const created = await imageRepository.create(image)

      expect(created.id).toBe(image.id)
      expect(created.propertyId).toBe(listing.id)
      expect(created.createdAt).toBeInstanceOf(Date)
      expect(created.updatedAt).toBeInstanceOf(Date)

      const found = await imageRepository.findById(image.id)
      expect(found).toEqual(created)
    })

    it('returns null for an unknown id', async () => {
      expect(await imageRepository.findById(crypto.randomUUID())).toBeNull()
    })

    it('rejects an image whose propertyId does not reference an existing listing (FK violation surfaces)', async () => {
      await expect(
        imageRepository.create(newImage({ propertyId: crypto.randomUUID() })),
      ).rejects.toThrow()
    })

    it('lists every image for a property ordered by position ascending', async () => {
      await imageRepository.create(newImage({ position: 2 }))
      await imageRepository.create(newImage({ position: 0 }))
      await imageRepository.create(newImage({ position: 1 }))

      const listed = await imageRepository.listByProperty(listing.id)

      expect(listed.map((image) => image.position)).toEqual([0, 1, 2])
    })

    it('counts images for a property, excluding other properties', async () => {
      expect(await imageRepository.countByProperty(listing.id)).toBe(0)

      await imageRepository.create(newImage({ position: 0 }))
      await imageRepository.create(newImage({ position: 1 }))

      expect(await imageRepository.countByProperty(listing.id)).toBe(2)
    })

    it('updatePosition changes only the position', async () => {
      const created = await imageRepository.create(newImage({ position: 0 }))

      const updated = await imageRepository.updatePosition(created.id, 3)

      expect(updated.position).toBe(3)
      expect(updated.kind).toBe(created.kind)
    })

    it('updateKind changes only the kind', async () => {
      const created = await imageRepository.create(newImage({ kind: 'photo' }))

      const updated = await imageRepository.updateKind(created.id, 'floorplan')

      expect(updated.kind).toBe('floorplan')
      expect(updated.position).toBe(created.position)
    })

    it('delete removes the row', async () => {
      const created = await imageRepository.create(newImage())

      await imageRepository.delete(created.id)

      expect(await imageRepository.findById(created.id)).toBeNull()
    })

    it('delete is a no-op for an id that does not exist', async () => {
      await expect(
        imageRepository.delete(crypto.randomUUID()),
      ).resolves.toBeUndefined()
    })
  },
)
