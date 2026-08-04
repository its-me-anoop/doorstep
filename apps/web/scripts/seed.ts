/**
 * Local-dev seed script (PRD M0 exit criterion: "seed script"). Inserts the
 * fixed set of realistic Reading/Thames Valley listings from
 * scripts/seed-data.ts so there is something to look at when developing
 * locally.
 *
 * Idempotent: every run first deletes any existing rows carrying the known
 * seed slugs/firebase_uids, then re-inserts from the fixtures, all inside
 * one transaction — re-running is always safe and never duplicates rows.
 *
 * `agencies.created_by` and `users.agency_id` form a genuine FK cycle
 * (an agency requires its creating user to exist; a user's agency_id
 * points back at the agency). Both the delete and insert steps below
 * break that cycle deliberately — see the comments at each step.
 *
 * There is no live database or Docker on this development machine, so this
 * script cannot be run here — it is exercised for real by the
 * `integration` CI job against the postgis service container
 * (.github/workflows/ci.yml). Locally, scripts/seed-data.ts's fixtures are
 * covered by tests/unit/seed/seed-data.test.ts, and this file's shape is
 * covered by `pnpm typecheck`.
 */

import { inArray } from 'drizzle-orm'

import { getDb, schema } from '@/adapters/drizzle'
import type { Db } from '@/adapters/drizzle'

import {
  SEED_AGENCIES,
  SEED_PROPERTIES,
  SEED_USERS,
  type SeedAgency,
  type SeedProperty,
  type SeedPropertyImage,
  type SeedUser,
} from './seed-data'

const { agencies, users, properties, propertyImages } = schema

/** The transaction handle `db.transaction()` hands its callback — distinct
 * from `Db` itself in Drizzle's typings, extracted here so the delete/insert
 * helpers below can be typed without duplicating it by hand. */
type Tx = Parameters<Db['transaction']>[0] extends (tx: infer T) => unknown
  ? T
  : never

function assertNotProductionUnlessForced(): void {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== '1') {
    console.error(
      'Refusing to seed with NODE_ENV=production. Set SEED_FORCE=1 if ' +
        'you really mean to run the dev seed against this database.',
    )
    process.exit(1)
  }
}

function assertDatabaseUrlSet(): void {
  if (!process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. Point it at a local Postgres+PostGIS ' +
        'instance (see .env.example) before running `pnpm seed`.',
    )
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Insert-value mappers — pure translation from the fixture shape (natural
// keys: slug/email) to Drizzle's insert shape. Foreign keys are resolved
// by the caller once the row they point at actually exists.
// ---------------------------------------------------------------------------

function toUserInsertValues(user: SeedUser): typeof users.$inferInsert {
  return {
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    phone: user.phone,
    role: user.role,
    // Set in a follow-up UPDATE once the agency row exists (see main()) —
    // agencies.created_by requires the user to exist first.
    agencyId: null,
    status: user.status,
  }
}

function toAgencyInsertValues(
  agency: SeedAgency,
  createdBy: string,
): typeof agencies.$inferInsert {
  return {
    slug: agency.slug,
    name: agency.name,
    phone: agency.phone,
    email: agency.email,
    website: agency.website,
    address: agency.address,
    verified: agency.verified,
    createdBy,
  }
}

function toPropertyInsertValues(
  property: SeedProperty,
  listerId: string,
  agencyId: string | null,
): typeof properties.$inferInsert {
  const publishedAt = property.publishedAt
    ? new Date(property.publishedAt)
    : null
  return {
    listerId,
    agencyId,
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
    addressLine1: property.addressLine1,
    displayAddress: property.displayAddress,
    town: property.town,
    outcode: property.outcode,
    postcode: property.postcode,
    location: property.location,
    locationApproximate: property.locationApproximate,
    publishedAt,
    // Never changed since it was first published; pending_review/draft
    // rows have never had a status change worth recording yet.
    statusChangedAt: publishedAt,
  }
}

function toImageInsertValues(
  image: SeedPropertyImage,
  propertyId: string,
): typeof propertyImages.$inferInsert {
  return {
    propertyId,
    kind: image.kind,
    storagePath: image.storagePath,
    position: image.position,
    width: image.width,
    height: image.height,
    blurhash: image.blurhash,
    altText: image.altText,
  }
}

// ---------------------------------------------------------------------------
// Delete (idempotency) — known slugs/firebase_uids only, so this never
// touches non-seed data a developer created locally.
// ---------------------------------------------------------------------------

async function deleteExistingSeedRows(tx: Tx): Promise<void> {
  const propertySlugs = SEED_PROPERTIES.map((p) => p.slug)
  const agencySlugs = SEED_AGENCIES.map((a) => a.slug)
  const firebaseUids = SEED_USERS.map((u) => u.firebaseUid)

  // 1. Properties first — property_images cascade automatically, and this
  //    frees the users.lister_id / properties.agency_id references.
  await tx.delete(properties).where(inArray(properties.slug, propertySlugs))

  // 2. Break the users<->agencies FK cycle by nulling the edge that isn't
  //    NOT NULL before touching either table.
  await tx
    .update(users)
    .set({ agencyId: null })
    .where(inArray(users.firebaseUid, firebaseUids))

  // 3. Now agencies can go — no user.agency_id references them anymore.
  await tx.delete(agencies).where(inArray(agencies.slug, agencySlugs))

  // 4. Now users can go — no agency.created_by references them anymore.
  await tx.delete(users).where(inArray(users.firebaseUid, firebaseUids))
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

async function insertSeedRows(tx: Tx): Promise<void> {
  // Users first, agency-less — agencies.created_by needs them to exist.
  const insertedUsers = await tx
    .insert(users)
    .values(SEED_USERS.map(toUserInsertValues))
    .returning({ id: users.id, email: users.email })
  const userIdByEmail = new Map(insertedUsers.map((u) => [u.email, u.id]))

  const resolveUserId = (email: string): string => {
    const id = userIdByEmail.get(email)
    if (!id) {
      throw new Error(`seed.ts: no seeded user with email ${email}`)
    }
    return id
  }

  // Agencies, referencing the users just inserted.
  const insertedAgencies = await tx
    .insert(agencies)
    .values(
      SEED_AGENCIES.map((agency) =>
        toAgencyInsertValues(agency, resolveUserId(agency.createdByEmail)),
      ),
    )
    .returning({ id: agencies.id, slug: agencies.slug })
  const agencyIdBySlug = new Map(insertedAgencies.map((a) => [a.slug, a.id]))

  const resolveAgencyId = (slug: string | null): string | null => {
    if (slug === null) return null
    const id = agencyIdBySlug.get(slug)
    if (!id) {
      throw new Error(`seed.ts: no seeded agency with slug ${slug}`)
    }
    return id
  }

  // Now that agencies exist, point each agent's own user row at theirs.
  for (const user of SEED_USERS) {
    if (user.agencySlug !== null) {
      await tx
        .update(users)
        .set({ agencyId: resolveAgencyId(user.agencySlug) })
        .where(inArray(users.firebaseUid, [user.firebaseUid]))
    }
  }

  // Properties, referencing both.
  const insertedProperties = await tx
    .insert(properties)
    .values(
      SEED_PROPERTIES.map((property) =>
        toPropertyInsertValues(
          property,
          resolveUserId(property.listerEmail),
          resolveAgencyId(property.agencySlug),
        ),
      ),
    )
    .returning({ id: properties.id, slug: properties.slug })
  const propertyIdBySlug = new Map(
    insertedProperties.map((p) => [p.slug, p.id]),
  )

  // Images, referencing the properties just inserted.
  const imageRows = SEED_PROPERTIES.flatMap((property) => {
    const propertyId = propertyIdBySlug.get(property.slug)
    if (!propertyId) {
      throw new Error(
        `seed.ts: no inserted property with slug ${property.slug}`,
      )
    }
    return property.images.map((image) =>
      toImageInsertValues(image, propertyId),
    )
  })
  if (imageRows.length > 0) {
    await tx.insert(propertyImages).values(imageRows)
  }
}

async function main(): Promise<void> {
  assertNotProductionUnlessForced()
  assertDatabaseUrlSet()

  const db = getDb()
  await db.transaction(async (tx) => {
    await deleteExistingSeedRows(tx)
    await insertSeedRows(tx)
  })

  console.log(
    `Seeded ${SEED_AGENCIES.length} agencies, ${SEED_USERS.length} users ` +
      `and ${SEED_PROPERTIES.length} properties.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed script failed:', error)
    process.exit(1)
  })
