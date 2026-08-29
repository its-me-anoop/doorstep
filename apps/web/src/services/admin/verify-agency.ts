/**
 * VerifyAgency — ADM-3 mark an agency verified/unverified after offline
 * checks. Audit-logged.
 */

import type { Agency, AgencyRepository } from '@/ports/agency-repository'
import type { AuditLogRepository } from '@/ports/audit-log-repository'
import type { User } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class VerifyAgency {
  constructor(
    private readonly agencyRepository: AgencyRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(
    actor: User,
    agencyId: string,
    verified: boolean,
    reason?: string | null,
  ): Promise<Agency> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    const agency = await this.agencyRepository.findById(agencyId)
    if (!agency) {
      throw new Error(`Agency not found: ${agencyId}`)
    }

    const updated = await this.agencyRepository.update(agencyId, { verified })

    await this.auditLogRepository.append({
      actorId: actor.id,
      action: verified ? 'agency.verify' : 'agency.unverify',
      entityType: 'agency',
      entityId: agencyId,
      reason: reason ?? null,
    })

    return updated
  }
}
