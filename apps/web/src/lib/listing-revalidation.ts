/**
 * revalidateListingPaths — the on-demand ISR mechanism PRD §8.3 calls for
 * on the listing detail route ("ISR with on-demand revalidation
 * triggered by publish, edit and status changes"). Called from the route
 * layer (app/api/v1/listings/[id]/status/route.ts's POST,
 * app/api/v1/listings/[id]/route.ts's PATCH) after a mutation succeeds —
 * never from services/, which has no business knowing about Next's cache
 * or this app's URL scheme (DIP: services/ stays framework-free, PRD
 * §8.5).
 *
 * Two things get revalidated:
 *  1. The listing's own detail page, `/property/{slug}` — always, since
 *     every caller of this function just changed something about a
 *     listing that IS (or was, or is about to be) publicly visible.
 *  2. Any curated area landing page (`lib/areas.ts`) whose `match` the
 *     listing's current `town`/`outcode` satisfies — its "Newest in
 *     {area}" strip and live count can change whenever a listing in that
 *     area is published, hidden, or otherwise changes visibility.
 *     `findAreasMatchingListing` already returns zero, one, or (per that
 *     module's documented Caversham/Emmer Green overlap) occasionally
 *     more than one area; every match gets revalidated.
 *
 * Only ever called for the two mutations that actually affect a
 * *currently or newly visible* listing (status transitions; PATCH edits
 * to a published listing) — see those routes' own doc comments for why
 * submit/DELETE never call this (their target is never publicly visible
 * either side of the mutation).
 *
 * Known limitation, documented rather than engineered around: a PATCH
 * that changes a published listing's `town` only revalidates the area(s)
 * matching its *new* town — the *old* area's now-stale strip entry
 * self-heals on its own next revalidation window rather than needing a
 * second "before" read here. Town changes on an already-published
 * listing are a rare edit, not the common path this function is
 * optimising for.
 */

import { revalidatePath } from 'next/cache'

import type { Channel } from '@/domain/enums'
import { findAreasMatchingListing } from '@/lib/areas'

export interface RevalidatableListing {
  slug: string
  channel: Channel
  town: string
  outcode: string
}

const CHANNEL_SLUG: Record<Channel, string> = {
  sale: 'for-sale',
  rent: 'to-rent',
}

export function revalidateListingPaths(listing: RevalidatableListing): void {
  revalidatePath(`/property/${listing.slug}`)

  for (const area of findAreasMatchingListing(listing.town, listing.outcode)) {
    revalidatePath(`/${CHANNEL_SLUG[listing.channel]}/${area.slug}`)
  }
}
