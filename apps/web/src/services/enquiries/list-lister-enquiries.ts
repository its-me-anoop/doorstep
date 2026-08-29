/**
 * ListListerEnquiries — lister inbox (PRD §6.4 ENQ-4). Owners see their
 * own listings' enquiries; agents see the whole agency inbox.
 */

import type {
  Enquiry,
  EnquiryCursorPage,
  EnquiryReader,
  ListEnquiriesOptions,
} from '@/ports/enquiry-repository'
import type { User } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class ListListerEnquiries {
  constructor(private readonly enquiryReader: EnquiryReader) {}

  async execute(
    actor: User,
    options: ListEnquiriesOptions = {},
  ): Promise<EnquiryCursorPage<Enquiry>> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'owner', 'agent')

    return this.enquiryReader.listForLister(
      actor.id,
      actor.role === 'agent' ? actor.agencyId : null,
      options,
    )
  }
}
