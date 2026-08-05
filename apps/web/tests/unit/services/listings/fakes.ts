/**
 * In-memory fake for services/listings/*'s TDD suite (PRD §8.5). A single
 * class satisfies both ListingReader and ListingWriter, same as a real
 * repository would — services depend on whichever half (or both) they
 * need. `outboxWrites` and `priceChangeEvents` record every transactional
 * side effect a test asked for, so tests can assert on them directly
 * instead of re-deriving what "should" have happened.
 */

import type { OutboxOp, PropertyStatus } from '@/domain/enums'
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

const DEFAULT_LIMIT = 20

export class FakeListingRepository implements ListingReader, ListingWriter {
  private readonly byId = new Map<string, Listing>()
  private readonly insertionOrder: string[] = []
  private nextId = 1

  readonly outboxWrites: Array<{ propertyId: string; op: OutboxOp }> = []
  readonly priceChangeEvents: Array<{
    propertyId: string
    previous: number
    next: number
  }> = []

  async findById(id: string): Promise<Listing | null> {
    return this.byId.get(id) ?? null
  }

  async findBySlug(slug: string): Promise<Listing | null> {
    for (const listing of this.byId.values()) {
      if (listing.slug === slug) return listing
    }
    return null
  }

  async listByLister(
    listerId: string,
    options: ListListingsOptions = {},
  ): Promise<ListingCursorPage<Listing>> {
    return this.paginate((listing) => listing.listerId === listerId, options)
  }

  async listByAgency(
    agencyId: string,
    options: ListListingsOptions = {},
  ): Promise<ListingCursorPage<Listing>> {
    return this.paginate((listing) => listing.agencyId === agencyId, options)
  }

  async createDraft(draft: NewListingDraft): Promise<Listing> {
    const id = `listing-${this.nextId++}`
    const now = new Date()
    const created: Listing = {
      ...draft,
      id,
      status: 'draft',
      publishedAt: null,
      statusChangedAt: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(id, created)
    this.insertionOrder.push(id)
    return created
  }

  async update(id: string, changes: ListingUpdateFields): Promise<Listing> {
    return this.applyChanges(id, changes)
  }

  async updateWithSideEffects(
    id: string,
    changes: ListingUpdateFields,
    sideEffects: ListingSideEffects,
  ): Promise<Listing> {
    const updated = this.applyChanges(id, changes)
    if (sideEffects.outboxUpsert) {
      this.outboxWrites.push({ propertyId: id, op: 'upsert' })
    }
    if (sideEffects.priceChangeEvent) {
      this.priceChangeEvents.push({
        propertyId: id,
        ...sideEffects.priceChangeEvent,
      })
    }
    return updated
  }

  async transitionWithOutbox(
    id: string,
    to: PropertyStatus,
    options: ListingTransitionOptions,
  ): Promise<Listing> {
    const existing = this.getOrThrow(id)
    const updated: Listing = {
      ...existing,
      status: to,
      statusChangedAt: options.statusChangedAt,
      publishedAt: options.publishedAt ?? existing.publishedAt,
      updatedAt: options.statusChangedAt,
    }
    this.byId.set(id, updated)
    if (options.outboxOp) {
      this.outboxWrites.push({ propertyId: id, op: options.outboxOp })
    }
    return updated
  }

  async delete(id: string): Promise<void> {
    this.getOrThrow(id)
    this.byId.delete(id)
  }

  /** Test helper: seed a listing directly, bypassing createDraft(). */
  seed(listing: Listing): void {
    if (!this.byId.has(listing.id)) this.insertionOrder.push(listing.id)
    this.byId.set(listing.id, listing)
  }

  private applyChanges(id: string, changes: ListingUpdateFields): Listing {
    const existing = this.getOrThrow(id)
    const updated: Listing = { ...existing, ...changes, updatedAt: new Date() }
    this.byId.set(id, updated)
    return updated
  }

  private getOrThrow(id: string): Listing {
    const existing = this.byId.get(id)
    if (!existing) throw new ListingNotFoundError(id)
    return existing
  }

  private paginate(
    predicate: (listing: Listing) => boolean,
    { cursor, limit = DEFAULT_LIMIT }: ListListingsOptions,
  ): ListingCursorPage<Listing> {
    // Newest first, mirroring DrizzleListingRepository's `id DESC` — see
    // that file's doc comment for why a UUID v7 primary key makes this
    // equivalent to created_at DESC.
    const matches = this.insertionOrder
      .map((id) => this.byId.get(id))
      .filter((listing): listing is Listing => listing !== undefined)
      .filter(predicate)
      .reverse()

    const startIndex = cursor
      ? matches.findIndex((listing) => listing.id === cursor) + 1
      : 0
    const page = matches.slice(startIndex, startIndex + limit)
    const nextCursor =
      startIndex + limit < matches.length ? (page.at(-1)?.id ?? null) : null

    return { data: page, nextCursor }
  }
}
