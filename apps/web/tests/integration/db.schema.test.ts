import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as schema from '@/adapters/drizzle/schema'
import { agencies, properties, users } from '@/adapters/drizzle/schema'

// This suite talks to a real Postgres+PostGIS instance and runs the actual
// migrations in src/adapters/drizzle/migrations. There is no Docker and no
// live database on this development machine, so it is gated on
// TEST_DATABASE_URL and skips cleanly here — it exercises for real in CI,
// which provides a Postgres+PostGIS service container (PRD §8.8).
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(
  dirname,
  '../../src/adapters/drizzle/migrations',
)

describe.skipIf(!TEST_DATABASE_URL)('Drizzle schema (live database)', () => {
  let client: ReturnType<typeof postgres>
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    client = postgres(TEST_DATABASE_URL as string, { max: 1 })
    db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder })
  })

  afterAll(async () => {
    await client.end()
  })

  it('enables the postgis extension', async () => {
    const rows = await client`
      select extname from pg_extension where extname = 'postgis'
    `
    expect(rows).toHaveLength(1)
  })

  it('enables the citext extension', async () => {
    const rows = await client`
      select extname from pg_extension where extname = 'citext'
    `
    expect(rows).toHaveLength(1)
  })

  it('has every property_status enum value from the state machine (PRD §9.3)', async () => {
    const rows = await client<{ value: string }[]>`
      select unnest(enum_range(null::property_status))::text as value
    `
    const values = rows.map((r) => r.value)
    expect(values).toEqual([
      'draft',
      'pending_review',
      'rejected',
      'published',
      'under_offer',
      'completed',
      'hidden',
      'archived',
    ])
  })

  it('inserts a property with a location point and reads it back', async () => {
    const [user] = await db
      .insert(users)
      .values({
        firebaseUid: `firebase-${crypto.randomUUID()}`,
        email: `lister-${crypto.randomUUID()}@example.co.uk`,
        displayName: 'Test Lister',
        role: 'owner',
        status: 'active',
      })
      .returning()

    expect(user).toBeDefined()

    const readingCentre = { lat: 51.4543, lng: -0.9781 }

    const [property] = await db
      .insert(properties)
      .values({
        listerId: user!.id,
        channel: 'sale',
        propertyType: 'terraced',
        title: '3 bed terraced house for sale',
        slug: `test-property-${crypto.randomUUID()}`,
        description: 'A lovely test house.',
        bedrooms: 3,
        bathrooms: 1,
        price: 350000,
        priceQualifier: 'fixed',
        addressLine1: '1 Test Street',
        displayAddress: 'Test Street, Reading, RG1',
        town: 'Reading',
        outcode: 'RG1',
        postcode: 'RG1 1AA',
        location: readingCentre,
      })
      .returning()

    expect(property).toBeDefined()
    expect(property!.location).toEqual(readingCentre)

    const [found] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, property!.id))

    expect(found?.location).toEqual(readingCentre)
  })

  it('rejects an agency whose created_by does not reference an existing user (PRD §9.2)', async () => {
    await expect(
      db.insert(agencies).values({
        name: 'Ghost Agency',
        slug: `ghost-agency-${crypto.randomUUID()}`,
        phone: '01189000000',
        email: `ghost-${crypto.randomUUID()}@example.co.uk`,
        website: 'https://example.co.uk',
        address: '1 Nowhere Street, Reading',
        createdBy: crypto.randomUUID(),
      }),
    ).rejects.toThrow()
  })
})
