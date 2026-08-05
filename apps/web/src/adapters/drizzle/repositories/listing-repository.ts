/**
 * DrizzleListingRepository — the ListingReader/ListingWriter ports
 * (ports/listing-repository.ts) implemented against `properties`, in the
 * same shape as DrizzleAgencyRepository/DrizzleUserRepository:
 * constructor-injected `Db` (DIP), pure row mapper exported and
 * unit-tested directly, the class itself exercised against a real
 * Postgres+PostGIS instance in tests/integration/.
 *
 * Cursor pagination (listByLister/listByAgency): `properties.id` is a
 * UUID v7 (adapters/drizzle/schema.ts's idColumn — client-generated,
 * time-ordered), and Postgres's uuid type compares byte-for-byte in the
 * same order the hex string prints in, so `ORDER BY id DESC` is
 * equivalent to `ORDER BY created_at DESC` without a second index. A page
 * is `limit + 1` rows fetched, the extra row trimmed and its presence
 * used to decide whether there's a next page — no separate COUNT query.
 *
 * Transactional guarantee (PRD §8.6, ports/listing-repository.ts's doc
 * comment): updateWithSideEffects and transitionWithOutbox each run their
 * properties UPDATE and their outbox/events INSERTs inside one
 * `db.transaction`, so a crash between them is impossible — either both
 * land or neither does.
 */

import { and, desc, eq, lt, type SQL } from 'drizzle-orm'

import type { PropertyStatus } from '@/domain/enums'
import {
  ListingNotFoundError,
  type Listing,
  type ListingCursorPage,
  type ListingReader,
  type ListListingsOptions,
  type ListingSideEffects,
  type ListingTransitionOptions,
  type ListingUpdateFields,
  type ListingWriter,
  type NewListingDraft,
} from '@/ports/listing-repository'

import type { Db } from '../client'
import { events, outbox, properties } from '../schema'

type PropertyRow = typeof properties.$inferSelect

const DEFAULT_PAGE_LIMIT = 20

/** Maps a `properties` table row to the ListingRepository port's `Listing`
 * shape. Pure and DB-free, so it is unit-tested directly. Field names are
 * identical on both sides (schema.ts's columns mirror domain/property.ts's
 * PropertyEntity one-for-one), so this is a straight passthrough rather
 * than a real transformation — kept as its own named function anyway so
 * every other repository in this directory reads the same way, and so a
 * future divergence between the row and port shapes has one obvious place
 * to add the mapping. */
export function mapRowToListing(row: PropertyRow): Listing {
  return {
    id: row.id,
    listerId: row.listerId,
    agencyId: row.agencyId,
    channel: row.channel,
    status: row.status,
    propertyType: row.propertyType,
    title: row.title,
    slug: row.slug,
    description: row.description,
    features: row.features,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    price: row.price,
    priceQualifier: row.priceQualifier,
    tenure: row.tenure,
    deposit: row.deposit,
    furnished: row.furnished,
    availableFrom: row.availableFrom,
    epcRating: row.epcRating,
    councilTaxBand: row.councilTaxBand,
    newHome: row.newHome,
    addressLine1: row.addressLine1,
    displayAddress: row.displayAddress,
    town: row.town,
    outcode: row.outcode,
    postcode: row.postcode,
    location: row.location,
    locationApproximate: row.locationApproximate,
    publishedAt: row.publishedAt,
    statusChangedAt: row.statusChangedAt,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleListingRepository implements ListingReader, ListingWriter {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Listing | null> {
    const [row] = await this.db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1)
    return row ? mapRowToListing(row) : null
  }

  async findBySlug(slug: string): Promise<Listing | null> {
    const [row] = await this.db
      .select()
      .from(properties)
      .where(eq(properties.slug, slug))
      .limit(1)
    return row ? mapRowToListing(row) : null
  }

  async listByLister(
    listerId: string,
    options?: ListListingsOptions,
  ): Promise<ListingCursorPage<Listing>> {
    return this.listBy(eq(properties.listerId, listerId), options)
  }

  async listByAgency(
    agencyId: string,
    options?: ListListingsOptions,
  ): Promise<ListingCursorPage<Listing>> {
    return this.listBy(eq(properties.agencyId, agencyId), options)
  }

  async createDraft(draft: NewListingDraft): Promise<Listing> {
    const [row] = await this.db
      .insert(properties)
      .values({
        listerId: draft.listerId,
        agencyId: draft.agencyId,
        channel: draft.channel,
        status: 'draft',
        propertyType: draft.propertyType,
        title: draft.title,
        slug: draft.slug,
        description: draft.description,
        features: draft.features,
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        price: draft.price,
        priceQualifier: draft.priceQualifier,
        tenure: draft.tenure,
        deposit: draft.deposit,
        furnished: draft.furnished,
        availableFrom: draft.availableFrom,
        epcRating: draft.epcRating,
        councilTaxBand: draft.councilTaxBand,
        newHome: draft.newHome,
        addressLine1: draft.addressLine1,
        displayAddress: draft.displayAddress,
        town: draft.town,
        outcode: draft.outcode,
        postcode: draft.postcode,
        location: draft.location,
        locationApproximate: draft.locationApproximate,
      })
      .returning()
    if (!row) {
      throw new Error(
        'DrizzleListingRepository.createDraft: insert returned no row',
      )
    }
    return mapRowToListing(row)
  }

  async update(id: string, changes: ListingUpdateFields): Promise<Listing> {
    const [row] = await this.db
      .update(properties)
      .set(changes)
      .where(eq(properties.id, id))
      .returning()
    if (!row) throw new ListingNotFoundError(id)
    return mapRowToListing(row)
  }

  async updateWithSideEffects(
    id: string,
    changes: ListingUpdateFields,
    sideEffects: ListingSideEffects,
  ): Promise<Listing> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(properties)
        .set(changes)
        .where(eq(properties.id, id))
        .returning()
      if (!row) throw new ListingNotFoundError(id)

      if (sideEffects.outboxUpsert) {
        await tx.insert(outbox).values({ propertyId: id, op: 'upsert' })
      }

      if (sideEffects.priceChangeEvent) {
        await tx.insert(events).values({
          name: 'listing_price_changed',
          // `events.anon_id` is NOT NULL and, per PRD §9.2, models an
          // anonymous visitor session — this write has no such session
          // (it's a server-side side effect of an authenticated PATCH,
          // not a client analytics beacon). The listing's own id is used
          // as a stable, always-available stand-in rather than inventing
          // a session that doesn't exist; `userId` is left null for the
          // same reason (the actor isn't threaded through this narrow
          // port — see ports/listing-repository.ts's ListingSideEffects).
          // PRD §6.5 LST-4 calls this "the data ... captured from day
          // one" ahead of a real phase-3 price-history table; this is
          // the documented interim shape.
          anonId: id,
          userId: null,
          properties: {
            propertyId: id,
            previous: sideEffects.priceChangeEvent.previous,
            next: sideEffects.priceChangeEvent.next,
            channel: row.channel,
          },
        })
      }

      return mapRowToListing(row)
    })
  }

  async transitionWithOutbox(
    id: string,
    to: PropertyStatus,
    options: ListingTransitionOptions,
  ): Promise<Listing> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(properties)
        .set({
          status: to,
          statusChangedAt: options.statusChangedAt,
          ...(options.publishedAt ? { publishedAt: options.publishedAt } : {}),
        })
        .where(eq(properties.id, id))
        .returning()
      if (!row) throw new ListingNotFoundError(id)

      if (options.outboxOp) {
        await tx.insert(outbox).values({ propertyId: id, op: options.outboxOp })
      }

      return mapRowToListing(row)
    })
  }

  private async listBy(
    predicate: SQL,
    { cursor, limit = DEFAULT_PAGE_LIMIT }: ListListingsOptions = {},
  ): Promise<ListingCursorPage<Listing>> {
    const where = cursor ? and(predicate, lt(properties.id, cursor)) : predicate
    const rows = await this.db
      .select()
      .from(properties)
      .where(where)
      .orderBy(desc(properties.id))
      .limit(limit + 1)

    const page = rows.slice(0, limit)
    const nextCursor = rows.length > limit ? (page.at(-1)?.id ?? null) : null

    return { data: page.map(mapRowToListing), nextCursor }
  }
}
