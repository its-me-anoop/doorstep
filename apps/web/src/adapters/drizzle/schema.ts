/**
 * Drizzle ORM schema for every M0 entity (PRD §9.2). Only this directory
 * (and lib/composition.ts) may import drizzle-orm — domain/ and
 * services/ stay framework-free and depend on ports/ only (PRD §8.5).
 *
 * Conventions used throughout:
 *  - every table has `id uuid` PK (except `saved_properties`, composite
 *    PK per PRD) generated client-side via `$defaultFn(() => uuidv7())` —
 *    inserts must go through Drizzle so the v7 (time-ordered) id is
 *    generated before the row is written, never via a DB-side default.
 *  - `created_at` defaults to `now()`; `updated_at` defaults to `now()`
 *    and is bumped by Drizzle's `$onUpdate` on every update.
 *  - money is always an integer (pounds, or pounds-per-calendar-month for
 *    rent) — see src/domain/money.ts for the convention.
 */

import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

import { citext, geographyPoint } from './custom-types'

// ---------------------------------------------------------------------------
// Enums (PRD §9.2) — names mirror src/domain/enums.ts exactly.
// ---------------------------------------------------------------------------

export const channelEnum = pgEnum('channel', ['sale', 'rent'])

export const propertyStatusEnum = pgEnum('property_status', [
  'draft',
  'pending_review',
  'rejected',
  'published',
  'under_offer',
  'completed',
  'hidden',
  'archived',
])

export const propertyTypeEnum = pgEnum('property_type', [
  'detached',
  'semi_detached',
  'terraced',
  'flat',
  'bungalow',
  'maisonette',
  'land',
  'other',
])

export const priceQualifierEnum = pgEnum('price_qualifier', [
  'fixed',
  'guide_price',
  'offers_over',
  'offers_in_region',
  'poa',
])

export const tenureEnum = pgEnum('tenure', [
  'freehold',
  'leasehold',
  'share_of_freehold',
  'unknown',
])

export const furnishedEnum = pgEnum('furnished', [
  'furnished',
  'part_furnished',
  'unfurnished',
])

export const epcRatingEnum = pgEnum('epc_rating', [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
])

export const councilTaxBandEnum = pgEnum('council_tax_band', [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
])

export const userRoleEnum = pgEnum('user_role', [
  'user',
  'owner',
  'agent',
  'admin',
])

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'suspended',
  'banned',
])

export const enquiryStatusEnum = pgEnum('enquiry_status', [
  'new',
  'contacted',
  'closed',
])

export const imageKindEnum = pgEnum('image_kind', ['photo', 'floorplan', 'epc'])

export const alertFrequencyEnum = pgEnum('alert_frequency', [
  'none',
  'daily',
  'instant',
])

export const outboxOpEnum = pgEnum('outbox_op', ['upsert', 'delete'])

export const paymentPurposeEnum = pgEnum('payment_purpose', [
  'subscription',
  'featured_listing',
])

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const idColumn = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

// ---------------------------------------------------------------------------
// agencies
// ---------------------------------------------------------------------------

export const agencies = pgTable(
  'agencies',
  {
    id: idColumn(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoPath: text('logo_path'),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    website: text('website').notNull(),
    address: text('address').notNull(),
    verified: boolean('verified').notNull().default(false),
    // Forward reference to `users`, declared further down this file. The
    // explicit `AnyPgColumn` return annotation is required (not just
    // stylistic) because `users.agencyId` references `agencies` right
    // back — without it, TS can't resolve the mutually-recursive
    // `agencies`/`users` table types and errors with TS7022/TS7024. This
    // is Drizzle's documented pattern for circular FK references. The two
    // tables form a genuine FK cycle; scripts/seed.ts's insert/delete
    // ordering deliberately breaks it.
    createdBy: uuid('created_by')
      .notNull()
      .references((): AnyPgColumn => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex('agencies_slug_idx').on(t.slug)],
)

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: idColumn(),
    firebaseUid: text('firebase_uid').notNull(),
    email: citext('email').notNull(),
    displayName: text('display_name').notNull(),
    phone: text('phone'),
    role: userRoleEnum('role').notNull().default('user'),
    agencyId: uuid('agency_id').references(() => agencies.id),
    status: userStatusEnum('status').notNull().default('active'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_firebase_uid_idx').on(t.firebaseUid),
    uniqueIndex('users_email_idx').on(t.email),
  ],
)

// ---------------------------------------------------------------------------
// properties
// ---------------------------------------------------------------------------

export const properties = pgTable(
  'properties',
  {
    id: idColumn(),
    listerId: uuid('lister_id')
      .notNull()
      .references(() => users.id),
    agencyId: uuid('agency_id').references(() => agencies.id),
    channel: channelEnum('channel').notNull(),
    status: propertyStatusEnum('status').notNull().default('draft'),
    propertyType: propertyTypeEnum('property_type').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    features: text('features')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    bedrooms: smallint('bedrooms').notNull(),
    bathrooms: smallint('bathrooms').notNull(),
    price: integer('price').notNull(),
    priceQualifier: priceQualifierEnum('price_qualifier').notNull(),
    // Sale only.
    tenure: tenureEnum('tenure'),
    // Rent only, pounds.
    deposit: integer('deposit'),
    // Rent only.
    furnished: furnishedEnum('furnished'),
    // Rent only.
    availableFrom: date('available_from', { mode: 'date' }),
    // Required for rentals at publish.
    epcRating: epcRatingEnum('epc_rating'),
    councilTaxBand: councilTaxBandEnum('council_tax_band'),
    newHome: boolean('new_home').notNull().default(false),
    // Private, never rendered publicly.
    addressLine1: text('address_line1').notNull(),
    displayAddress: text('display_address').notNull(),
    town: text('town').notNull(),
    outcode: text('outcode').notNull(),
    // Private.
    postcode: text('postcode').notNull(),
    location: geographyPoint('location').notNull(),
    locationApproximate: boolean('location_approximate')
      .notNull()
      .default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('properties_slug_idx').on(t.slug),
    index('properties_location_gist_idx').using('gist', t.location),
    index('properties_status_channel_price_idx').on(
      t.status,
      t.channel,
      t.price,
    ),
    index('properties_agency_status_idx').on(t.agencyId, t.status),
    index('properties_lister_status_idx').on(t.listerId, t.status),
    index('properties_town_status_idx').on(t.town, t.status),
  ],
)

// ---------------------------------------------------------------------------
// property_images
// ---------------------------------------------------------------------------

export const propertyImages = pgTable(
  'property_images',
  {
    id: idColumn(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    kind: imageKindEnum('kind').notNull(),
    storagePath: text('storage_path').notNull(),
    position: smallint('position').notNull().default(0),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    blurhash: text('blurhash').notNull(),
    altText: text('alt_text'),
    ...timestamps,
  },
  (t) => [index('property_images_property_id_idx').on(t.propertyId)],
)

// ---------------------------------------------------------------------------
// enquiries
// ---------------------------------------------------------------------------

export const enquiries = pgTable(
  'enquiries',
  {
    id: idColumn(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    senderId: uuid('sender_id').references(() => users.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    message: text('message').notNull(),
    viewingRequested: boolean('viewing_requested').notNull().default(false),
    status: enquiryStatusEnum('status').notNull().default('new'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('enquiries_property_id_idx').on(t.propertyId)],
)

// ---------------------------------------------------------------------------
// saved_properties (composite PK)
// ---------------------------------------------------------------------------

export const savedProperties = pgTable(
  'saved_properties',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.propertyId] })],
)

// ---------------------------------------------------------------------------
// saved_searches
// ---------------------------------------------------------------------------

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: idColumn(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    criteria: jsonb('criteria').notNull(),
    alertFrequency: alertFrequencyEnum('alert_frequency')
      .notNull()
      .default('none'),
    lastAlertedAt: timestamp('last_alerted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('saved_searches_user_id_idx').on(t.userId)],
)

// ---------------------------------------------------------------------------
// payments (phase 2, schema reserved)
// ---------------------------------------------------------------------------

export const payments = pgTable('payments', {
  id: idColumn(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  agencyId: uuid('agency_id').references(() => agencies.id),
  purpose: paymentPurposeEnum('purpose').notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeRef: text('stripe_ref').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// audit_log (insert-only)
// ---------------------------------------------------------------------------

export const auditLog = pgTable('audit_log', {
  id: idColumn(),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ---------------------------------------------------------------------------
// outbox
// ---------------------------------------------------------------------------

export const outbox = pgTable(
  'outbox',
  {
    id: idColumn(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    op: outboxOpEnum('op').notNull(),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    // Lease timestamp for DrizzleOutboxRepository.claimBatch (PRD §8.6's
    // "Vercel Cron worker drains the outbox") — set to the claiming run's
    // start time when a row is claimed, cleared conceptually (not
    // physically — see that method's doc comment) once its lease expires.
    // Lets a second, overlapping cron invocation skip rows an in-flight
    // run already claimed instead of double-processing them.
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (t) => [index('outbox_unprocessed_idx').on(t.processedAt)],
)

// ---------------------------------------------------------------------------
// events (first-party analytics)
// ---------------------------------------------------------------------------

export const events = pgTable('events', {
  id: idColumn(),
  name: text('name').notNull(),
  anonId: text('anon_id').notNull(),
  userId: uuid('user_id').references(() => users.id),
  properties: jsonb('properties').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
