/**
 * DecideListing — ADM-1 approve/reject pending listings. Admin-only;
 * transitions pending_review → published|rejected with outbox side
 * effects, audit log, and lister email.
 */

import { assertTransition } from '@/domain/property-status-machine'
import type { AuditLogRepository } from '@/ports/audit-log-repository'
import type { Clock } from '@/ports/clock'
import type {
  Listing,
  ListingReader,
  ListingWriter,
} from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { Mailer } from '@/ports/mailer'
import type { User, UserRepository } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import { ListingDecisionValidationError } from './errors'

export type ListingDecision = 'approve' | 'reject'

export interface DecideListingInput {
  listingId: string
  decision: ListingDecision
  rejectionReason?: string | null
}

export interface DecideListingDeps {
  listingBaseUrl?: string
}

export class DecideListing {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly listingWriter: ListingWriter,
    private readonly userRepository: UserRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly deps: DecideListingDeps = {},
  ) {}

  async execute(actor: User, input: DecideListingInput): Promise<Listing> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    if (input.decision === 'reject') {
      const reason = input.rejectionReason?.trim()
      if (!reason) {
        throw new ListingDecisionValidationError([
          {
            path: 'rejectionReason',
            message: 'A rejection reason is required.',
          },
        ])
      }
    }

    const listing = await this.listingReader.findById(input.listingId)
    if (!listing) throw new ListingNotFoundError(input.listingId)

    const now = this.clock.now()

    if (input.decision === 'approve') {
      assertTransition(listing.status, 'published')
      const updated = await this.listingWriter.transitionWithOutbox(
        input.listingId,
        'published',
        {
          statusChangedAt: now,
          publishedAt: listing.publishedAt ?? now,
          rejectionReason: null,
          outboxOp: 'upsert',
        },
      )

      await this.auditLogRepository.append({
        actorId: actor.id,
        action: 'listing.approve',
        entityType: 'listing',
        entityId: listing.id,
      })

      await this.emailLister(listing, 'listing-approved', {
        listingTitle: listing.title,
        listingUrl: this.listingUrl(listing.slug),
      })

      return updated
    }

    assertTransition(listing.status, 'rejected')
    const reason = input.rejectionReason!.trim()
    const updated = await this.listingWriter.transitionWithOutbox(
      input.listingId,
      'rejected',
      {
        statusChangedAt: now,
        rejectionReason: reason,
        outboxOp: null,
      },
    )

    await this.auditLogRepository.append({
      actorId: actor.id,
      action: 'listing.reject',
      entityType: 'listing',
      entityId: listing.id,
      reason,
    })

    await this.emailLister(listing, 'listing-rejected', {
      listingTitle: listing.title,
      reason,
    })

    return updated
  }

  private listingUrl(slug: string): string {
    const base = this.deps.listingBaseUrl ?? 'https://doorstep.local'
    return `${base}/property/${slug}`
  }

  private async emailLister(
    listing: Listing,
    template: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const lister = await this.userRepository.findById(listing.listerId)
    if (!lister) return

    await this.mailer.send({
      to: lister.email,
      subject:
        template === 'listing-approved'
          ? `Your listing is live: ${listing.title}`
          : `Action needed on your listing: ${listing.title}`,
      template,
      data,
    })
  }
}
