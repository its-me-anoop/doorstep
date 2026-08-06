/**
 * ListingRepository, split per ISP: ListingReader for read paths (the
 * lister dashboard's list view, object-level GET), ListingWriter for the
 * wizard and status controls. See PRD §8.5, §9.2, §9.3, §6.5 LST-2/4/5.
 *
 * `Listing` reuses domain/property.ts's `PropertyEntity` directly, the
 * same choice ports/agency-repository.ts made for `Agency` over
 * `AgencyEntity`: listing management needs essentially the whole
 * `properties` row, so a port-local subset would just redeclare the same
 * ~25 columns for no gain.
 *
 * Transactional guarantee (PRD §8.6): "every visibility-relevant mutation
 * writes a row to an outbox table in the same transaction." Two
 * ListingWriter methods carry that guarantee — updateWithSideEffects and
 * transitionWithOutbox — by writing the properties row AND its
 * outbox/events rows inside one database transaction, implemented
 * entirely inside adapters/drizzle/repositories/listing-repository.ts
 * (services/listings/* never see a transaction handle; DIP). Plain
 * `update` has no side effects to make atomic and is used for edits to a
 * listing that isn't currently publicly visible.
 */

import type { OutboxOp, PropertyStatus } from '@/domain/enums'
import type { PropertyEntity } from '@/domain/property'

export type Listing = PropertyEntity

export interface ListingCursorPage<T> {
  data: T[]
  /** The value to pass as `cursor` to fetch the next page; null once the
   * last page has been reached. */
  nextCursor: string | null
}

export interface ListListingsOptions {
  /** Opaque — always a previous page's `nextCursor`. See
   * DrizzleListingRepository's doc comment for the id-ordering it encodes
   * (properties.id is a UUID v7, so it is itself time-ordered). */
  cursor?: string | null
  limit?: number
}

export interface ListingReader {
  findById(id: string): Promise<Listing | null>
  findBySlug(slug: string): Promise<Listing | null>
  /** A lister's own listings, newest first — POST /api/v1/listings's GET
   * counterpart for an owner, or an agent viewing just their own. */
  listByLister(
    listerId: string,
    options?: ListListingsOptions,
  ): Promise<ListingCursorPage<Listing>>
  /** Every listing under an agency, newest first — an agent's "my
   * agency's listings" view (PRD §10). */
  listByAgency(
    agencyId: string,
    options?: ListListingsOptions,
  ): Promise<ListingCursorPage<Listing>>
  /**
   * Every publicly visible listing (`published`, `under_offer` — the same
   * pair services/search/map-listing-to-search-document.ts's
   * INDEXABLE_STATUSES and services/listings/change-listing-status.ts's
   * isVisible check, PRD §8.6), newest first with the same id-cursor
   * convention as listByLister/listByAgency. Exists for
   * services/search-sync/rebuild-search-index.ts's nightly full reindex,
   * which has to walk every indexable listing in the whole system rather
   * than one lister's or agency's — the outbox drain worker never needs
   * this (it works from outbox rows, not a full scan).
   */
  listIndexable(
    options?: ListListingsOptions,
  ): Promise<ListingCursorPage<Listing>>
  /** Count of listings `listIndexable` would return in total — the
   * "source of truth" side of RebuildSearchIndex's drift comparison
   * against Meilisearch's own document count (PRD §8.6: "a count-mismatch
   * alert catches sync bugs"). */
  countIndexable(): Promise<number>
}

/**
 * Fields CreateListingDraft (services/listings/) supplies when inserting a
 * new draft. `status` is always 'draft', and `publishedAt`/
 * `statusChangedAt`/`rejectionReason` are always null at creation — the
 * writer sets those itself rather than trusting a caller-supplied value.
 */
export type NewListingDraft = Omit<
  Listing,
  | 'id'
  | 'status'
  | 'publishedAt'
  | 'statusChangedAt'
  | 'rejectionReason'
  | 'createdAt'
  | 'updatedAt'
>

/**
 * Fields a PATCH may change. Excludes everything either always immutable
 * (`listerId`, `agencyId` — moving a listing to a different lister/agency
 * is a new listing, not an edit) or exclusively server-managed (`status`
 * and the status-machine timestamps move only through
 * transitionWithOutbox; `title`/`slug` are derived, never client-edited —
 * see domain/listing-copy.ts's doc comment).
 *
 * `channel` stays in this type (the writer will persist it) even though
 * it is immutable *once a listing has left draft* — the create-listing
 * wizard bootstraps every fresh draft with a placeholder channel
 * (new-listing-redirect.tsx) and relies on the user's real step-1 choice
 * reaching the stored row via this same PATCH. UpdateListing
 * (services/listings/update-listing.ts) is what actually enforces the
 * "immutable past draft" rule — a status-conditional business rule, not
 * a shape a repository-level type can express — by rejecting a channel
 * mismatch for any non-draft status before a change ever reaches this
 * writer.
 */
export type ListingUpdateFields = Partial<
  Omit<
    Listing,
    | 'id'
    | 'listerId'
    | 'agencyId'
    | 'status'
    | 'title'
    | 'slug'
    | 'publishedAt'
    | 'statusChangedAt'
    | 'rejectionReason'
    | 'createdAt'
    | 'updatedAt'
  >
>

export interface ListingPriceChangeEvent {
  previous: number
  next: number
}

export interface ListingSideEffects {
  /** Write an outbox `upsert` row in the same transaction — set when
   * editing a listing that is currently publicly visible (published,
   * under_offer), so search stays in sync within a minute (PRD §8.6).
   * Omitted for edits to a draft/rejected/pending_review listing, which
   * isn't indexed either way. */
  outboxUpsert?: boolean
  /** Write an `events` row named `listing_price_changed` in the same
   * transaction — set only when the edit actually changes `price` (PRD
   * §6.5 LST-4: "price changes are tracked ... the data is captured from
   * day one"). */
  priceChangeEvent?: ListingPriceChangeEvent
}

export interface ListingTransitionOptions {
  statusChangedAt: Date
  /** Stamped only on a listing's first publish — never overwritten by a
   * later transition (PRD §9.2: property_images... publishedAt null until
   * then). Omit on every other transition. */
  publishedAt?: Date
  /** `'upsert'` when `to` is publicly visible (published, under_offer);
   * `'delete'` when `to` stops being visible (hidden, completed); `null`
   * when the transition doesn't change visibility either side (e.g.
   * pending_review -> rejected). See
   * services/listings/change-listing-status.ts. */
  outboxOp: OutboxOp | null
}

export interface ListingWriter {
  createDraft(draft: NewListingDraft): Promise<Listing>
  /** Plain update, no side effects — draft/rejected/pending_review edits,
   * which are never publicly visible so there is nothing to keep in sync
   * (PRD §6.5 LST-4: "editing a draft or rejected listing is
   * unrestricted"). */
  update(id: string, changes: ListingUpdateFields): Promise<Listing>
  /** Same as `update`, but writes `sideEffects` in the same transaction —
   * used for edits to an already-visible listing. See this file's doc
   * comment for the transactional guarantee. */
  updateWithSideEffects(
    id: string,
    changes: ListingUpdateFields,
    sideEffects: ListingSideEffects,
  ): Promise<Listing>
  /**
   * Moves `status` to `to` and writes/removes the outbox visibility row
   * per `options.outboxOp`, atomically. Does not itself validate that
   * `to` is a legal transition from the listing's current status — callers
   * (services/listings/*) check that first with
   * domain/property-status-machine.ts's assertTransition.
   */
  transitionWithOutbox(
    id: string,
    to: PropertyStatus,
    options: ListingTransitionOptions,
  ): Promise<Listing>
  /**
   * Deletes a listing row outright — the one hard delete in this port
   * (every other mutation is a status transition, PRD §9.3). Callers
   * (services/listings/delete-listing.ts) restrict this to draft
   * listings only; this method itself does not re-check status, mirroring
   * `update`'s own "the writer persists, the service decides" split.
   * `property_images` rows cascade-delete at the schema level
   * (adapters/drizzle/schema.ts's `onDelete: 'cascade'`) — this method
   * does not additionally clean up those images' storage objects (see
   * services/listings/delete-listing.ts's doc comment for why that's a
   * documented gap, not an oversight).
   */
  delete(id: string): Promise<void>
}

/** Thrown by services/listings/* (not by the writer methods themselves —
 * every write is preceded by a ListingReader.findById the service already
 * needs for authz, so by the time a writer method runs the id is known
 * good) when a requested listing id does not exist. Route handlers map
 * this to 404. */
export class ListingNotFoundError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`No listing with id ${id}`)
    this.name = 'ListingNotFoundError'
    this.id = id
  }
}
