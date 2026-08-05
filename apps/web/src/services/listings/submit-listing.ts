/**
 * SubmitListing — the use case behind POST /api/v1/listings/{id}/submit
 * (PRD §6.5 LST-2's "review and submit for approval" step; PRD §9.3's
 * draft/rejected -> pending_review edge). Object-level authorised via
 * canManageListing; the transition itself goes through
 * domain/property-status-machine.ts's assertTransition, so any status
 * other than draft/rejected throws InvalidTransitionError before this
 * service's own completeness check even runs.
 *
 * Completeness is judged against lib/validation/listing.ts's
 * submitListingSchema, run here (not at the route) because the input is
 * the *stored* listing, not a request body — PRD §9.2's full field list,
 * channel-conditional (tenure for sale, EPC rating for rent).
 * pending_review is never publicly visible, so — unlike a published edit
 * — this transition writes no outbox row.
 */

import { assertTransition } from '@/domain/property-status-machine'
import { submitListingSchema } from '@/lib/validation/listing'
import type {
  Listing,
  ListingReader,
  ListingWriter,
} from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { Clock } from '@/ports/clock'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import { ListingIncompleteError } from './errors'

/**
 * Minimum photo count required before submission (PRD §6.5 LST-3). There
 * is no PropertyImageRepository yet — the image pipeline is a later M1
 * commit — so there is nothing to count rows against, hence 0 (no-op).
 * TODO(M1-images): once a PropertyImageRepository exists, inject it here,
 * count rows for the listing, and raise this above 0.
 */
export const PHOTO_MINIMUM = 0

export class SubmitListing {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly listingWriter: ListingWriter,
    private readonly clock: Clock,
  ) {}

  async execute(actor: User, listingId: string): Promise<Listing> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    assertTransition(listing.status, 'pending_review')

    const parsed = submitListingSchema.safeParse(this.toSubmitInput(listing))
    if (!parsed.success) {
      throw new ListingIncompleteError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      )
    }

    return this.listingWriter.transitionWithOutbox(
      listingId,
      'pending_review',
      {
        statusChangedAt: this.clock.now(),
        // pending_review is never publicly visible (PRD §8.6 — only
        // published/under_offer are indexed), so no outbox write.
        outboxOp: null,
      },
    )
  }

  private toSubmitInput(listing: Listing): unknown {
    return {
      channel: listing.channel,
      propertyType: listing.propertyType,
      title: listing.title,
      description: listing.description,
      features: listing.features,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      price: listing.price,
      priceQualifier: listing.priceQualifier,
      tenure: listing.tenure,
      deposit: listing.deposit,
      furnished: listing.furnished,
      availableFrom: listing.availableFrom,
      epcRating: listing.epcRating,
      councilTaxBand: listing.councilTaxBand,
      newHome: listing.newHome,
      addressLine1: listing.addressLine1,
      displayAddress: listing.displayAddress,
      town: listing.town,
      outcode: listing.outcode,
      postcode: listing.postcode,
      location: listing.location,
      locationApproximate: listing.locationApproximate,
    }
  }
}
