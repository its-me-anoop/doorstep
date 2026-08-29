/**
 * ListAuditLog — ADM-5 immutable admin accountability log.
 */

import type {
  AuditLogFilter,
  AuditLogPage,
  AuditLogRepository,
} from '@/ports/audit-log-repository'
import type { User } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class ListAuditLog {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async execute(actor: User, filter: AuditLogFilter = {}): Promise<AuditLogPage> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    return this.auditLogRepository.list(filter)
  }
}
