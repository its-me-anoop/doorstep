/**
 * services/admin/ — moderation, user management, analytics (PRD §6.6).
 */

export { DecideListing } from './decide-listing'
export type { DecideListingInput, ListingDecision } from './decide-listing'
export { ListModerationQueue } from './list-moderation-queue'
export { ManageUser } from './manage-user'
export type { ManageUserAction, ManageUserInput } from './manage-user'
export { SearchUsers } from './search-users'
export type { SearchUsersOptions } from './search-users'
export { VerifyAgency } from './verify-agency'
export { GetMetrics } from './get-metrics'
export type { AdminMetrics } from './get-metrics'
export { ListAuditLog } from './list-audit-log'
export { SubmitReport } from './submit-report'
export type { SubmitReportRequest } from './submit-report'
export { ListOpenReports } from './list-open-reports'
export { ResolveReport } from './resolve-report'
export type { ReportResolution } from './resolve-report'
export {
  ListingDecisionValidationError,
  ReportValidationError,
  UserManagementValidationError,
  TargetUserNotFoundError,
} from './errors'
