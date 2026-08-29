/**
 * ManageUser — ADM-3 suspend/reinstate/ban/set role. On suspend/ban,
 * every live listing owned by the user is hidden with an outbox delete.
 */

import type { UserRole, UserStatus } from '@/domain/enums'
import type { PropertyStatus } from '@/domain/enums'
import type { AuditLogRepository } from '@/ports/audit-log-repository'
import type { AuthGateway } from '@/ports/auth-gateway'
import type { Clock } from '@/ports/clock'
import type { ListingReader, ListingWriter } from '@/ports/listing-repository'
import type { User, UserRepository } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import {
  TargetUserNotFoundError,
  UserManagementValidationError,
} from './errors'

const LIVE_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'published',
  'under_offer',
])

export type ManageUserAction = 'suspend' | 'reinstate' | 'ban' | 'set_role'

export interface ManageUserInput {
  userId: string
  action: ManageUserAction
  role?: UserRole
  reason?: string | null
}

export class ManageUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly listingReader: ListingReader,
    private readonly listingWriter: ListingWriter,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly authGateway: AuthGateway,
    private readonly clock: Clock,
  ) {}

  async execute(actor: User, input: ManageUserInput): Promise<User> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    const target = await this.userRepository.findById(input.userId)
    if (!target) throw new TargetUserNotFoundError(input.userId)

    switch (input.action) {
      case 'suspend':
        return this.setStatus(actor, target, 'suspended', input.reason)
      case 'ban':
        return this.setStatus(actor, target, 'banned', input.reason)
      case 'reinstate':
        return this.setStatus(actor, target, 'active', input.reason)
      case 'set_role':
        return this.setRole(actor, target, input.role)
      default:
        throw new UserManagementValidationError(
          `Unknown action: ${input.action}`,
        )
    }
  }

  private async setStatus(
    actor: User,
    target: User,
    status: UserStatus,
    reason?: string | null,
  ): Promise<User> {
    const updated = await this.userRepository.update(target.id, { status })

    if (status === 'suspended' || status === 'banned') {
      await this.hideLiveListings(target.id)
      await this.authGateway.revokeSessions(target.firebaseUid)
    }

    await this.auditLogRepository.append({
      actorId: actor.id,
      action: `user.${status === 'active' ? 'reinstate' : status}`,
      entityType: 'user',
      entityId: target.id,
      reason: reason ?? null,
    })

    return updated
  }

  private async setRole(
    actor: User,
    target: User,
    role?: UserRole,
  ): Promise<User> {
    if (!role) {
      throw new UserManagementValidationError('role is required for set_role')
    }

    const updated = await this.userRepository.update(target.id, {
      role,
      agencyId:
        role === 'agent'
          ? target.agencyId
          : role === 'admin'
            ? null
            : target.agencyId,
    })

    await this.authGateway.setRoleClaims(target.firebaseUid, {
      role,
      agencyId: updated.agencyId ?? undefined,
    })

    await this.auditLogRepository.append({
      actorId: actor.id,
      action: 'user.set_role',
      entityType: 'user',
      entityId: target.id,
      metadata: { role },
    })

    return updated
  }

  private async hideLiveListings(listerId: string): Promise<void> {
    const now = this.clock.now()
    let cursor: string | null = null

    do {
      const page = await this.listingReader.listByLister(listerId, {
        cursor,
        limit: 50,
      })

      for (const listing of page.data) {
        if (!LIVE_STATUSES.has(listing.status)) continue
        await this.listingWriter.transitionWithOutbox(listing.id, 'hidden', {
          statusChangedAt: now,
          outboxOp: 'delete',
        })
      }

      cursor = page.nextCursor
    } while (cursor)
  }
}
