/**
 * DeleteListing — the use case behind DELETE /api/v1/listings/{id}
 * (M1-DESIGN-SPEC.md §4.3/§4.4). Not part of the PRD's original API
 * surface: the PRD documents drafts as resumable/deletable-in-spirit
 * ("a draft can be saved at any step and resumed") but never specifies a
 * hard-delete endpoint, and the M1 dashboard task that commissioned this
 * page found no existing route for it — hide/archive are status
 * transitions for a listing that has *been* something publicly, which a
 * never-submitted draft never was. This is the documented M1 contract
 * addition: a minimal DELETE, draft-only, following the exact
 * lookup-then-authz-then-business-rule shape every other
 * services/listings/* use case already uses.
 *
 * Object-level authorised via canManageListing, same rule as every other
 * listing mutation. Restricted to `status === 'draft'` — anything else
 * throws ListingNotDeletableError (mirrors UpdateListing's
 * ListingNotEditableError shape/reasoning).
 *
 * Storage cleanup: deliberately out of scope for this addition. A
 * draft's uploaded photos (if any) cascade-delete their
 * `property_images` rows at the schema level
 * (ports/listing-repository.ts's `delete` doc comment), but the
 * underlying storage objects (original + variants) are not cleaned up
 * here — services/images/delete-image.ts already owns that
 * responsibility for a single image, and generalising it to "every image
 * a about-to-be-deleted listing has" is a second, separable piece of
 * work this focused task does not pull in. Tracked as a known gap, not a
 * silent omission.
 */

import {
  ListingNotFoundError,
  type ListingReader,
  type ListingWriter,
} from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import { ListingNotDeletableError } from './errors'

export class DeleteListing {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly listingWriter: ListingWriter,
  ) {}

  async execute(actor: User, listingId: string): Promise<void> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    if (listing.status !== 'draft') {
      throw new ListingNotDeletableError(listing.status)
    }

    await this.listingWriter.delete(listingId)
  }
}
