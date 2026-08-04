/**
 * ListingRepository, split per ISP.
 *
 * Public/search-facing code should depend on ListingReader only; the
 * lister dashboard and moderation flows depend on ListingWriter. Neither
 * side is forced to depend on methods it never calls. See PRD §8.5, §9.2,
 * §9.3.
 *
 * The `Listing` shape here is a minimal projection of the `properties`
 * table (PRD §9.2). It is intentionally not the full domain entity —
 * later work in domain/ owns the real entity, value objects, and the
 * status state machine; ports may narrow their input/output types to that
 * entity once it exists.
 */

export type ListingId = string

export type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'rejected'
  | 'published'
  | 'under_offer'
  | 'completed'
  | 'hidden'
  | 'archived'

export type ListingChannel = 'sale' | 'rent'

export interface Listing {
  id: ListingId
  listerId: string
  agencyId: string | null
  channel: ListingChannel
  status: ListingStatus
  title: string
  slug: string
  price: number
}

export interface ListingReader {
  findById(id: ListingId): Promise<Listing | null>
  findBySlug(slug: string): Promise<Listing | null>
}

export interface ListingWriter {
  create(listing: Omit<Listing, 'id'>): Promise<Listing>
  update(id: ListingId, changes: Partial<Omit<Listing, 'id'>>): Promise<Listing>
  delete(id: ListingId): Promise<void>
}
