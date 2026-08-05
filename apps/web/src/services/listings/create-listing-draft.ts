/**
 * CreateListingDraft — the use case behind POST /api/v1/listings (PRD §6.5
 * LST-2 step 1). Owner/agent only; an agent's draft is stamped with their
 * agency, an owner's stays private (agencyId null) — the PRD §9.2
 * distinction the rest of the authz matrix (canManageListing) depends on.
 *
 * `title` and `slug` are always derived here (domain/listing-copy.ts),
 * never client input — see that module's doc comment. Every other
 * `properties` NOT NULL column not supplied by the (loose) draft schema
 * gets a neutral default (empty string / 0 / null / {lat:0,lng:0}) so the
 * insert satisfies the schema even for a step-1-only draft; the wizard
 * fills them in over subsequent PATCHes (services/listings/update-listing.ts),
 * and submitListingSchema (submit-listing.ts) is what actually requires
 * them to be real values before the listing can go to review.
 */

import {
  generateListingSlug,
  generateListingTitle,
} from '@/domain/listing-copy'
import type { DraftListingInput } from '@/lib/validation/listing'
import type {
  Listing,
  ListingWriter,
  NewListingDraft,
} from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'
import { requireRole } from '../authz/policies'

export class CreateListingDraft {
  constructor(private readonly listingWriter: ListingWriter) {}

  async execute(actor: User, input: DraftListingInput): Promise<Listing> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'owner', 'agent')

    const bedrooms = input.bedrooms ?? 0
    const outcode = input.outcode ?? ''
    const title = generateListingTitle({
      bedrooms,
      propertyType: input.propertyType,
      channel: input.channel,
    })
    const slug = generateListingSlug({
      bedrooms,
      propertyType: input.propertyType,
      outcode,
      uniqueSeed: crypto.randomUUID(),
    })

    const draft: NewListingDraft = {
      listerId: actor.id,
      agencyId: actor.role === 'agent' ? actor.agencyId : null,
      channel: input.channel,
      propertyType: input.propertyType,
      title,
      slug,
      description: input.description ?? '',
      features: input.features ?? [],
      bedrooms,
      bathrooms: input.bathrooms ?? 0,
      price: input.price ?? 0,
      priceQualifier: input.priceQualifier ?? 'poa',
      tenure: input.tenure ?? null,
      deposit: input.deposit ?? null,
      furnished: input.furnished ?? null,
      availableFrom: input.availableFrom ?? null,
      epcRating: input.epcRating ?? null,
      councilTaxBand: input.councilTaxBand ?? null,
      newHome: input.newHome ?? false,
      addressLine1: input.addressLine1 ?? '',
      displayAddress: input.displayAddress ?? '',
      town: input.town ?? '',
      outcode,
      postcode: input.postcode ?? '',
      location: input.location ?? { lat: 0, lng: 0 },
      locationApproximate: input.locationApproximate ?? false,
    }

    return this.listingWriter.createDraft(draft)
  }
}
