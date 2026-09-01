/**
 * UpdateEnquiryStatus — lister marks an enquiry new/contacted/closed
 * (PRD §6.4 ENQ-4). Authorised when the actor can manage the enquiry's
 * listing via canManageListing.
 */

import type { EnquiryStatus } from '@/domain/enums'
import {
  EnquiryNotFoundError,
  type Enquiry,
  type EnquiryReader,
  type EnquiryWriter,
} from '@/ports/enquiry-repository'
import type { ListingReader } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class UpdateEnquiryStatus {
  constructor(
    private readonly enquiryReader: EnquiryReader,
    private readonly enquiryWriter: EnquiryWriter,
    private readonly listingReader: ListingReader,
  ) {}

  async execute(
    actor: User,
    enquiryId: string,
    status: EnquiryStatus,
  ): Promise<Enquiry> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const enquiry = await this.enquiryReader.findById(enquiryId)
    if (!enquiry) throw new EnquiryNotFoundError(enquiryId)

    const listing = await this.listingReader.findById(enquiry.propertyId)
    if (!listing) throw new ListingNotFoundError(enquiry.propertyId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    return this.enquiryWriter.updateStatus(enquiryId, status)
  }
}
