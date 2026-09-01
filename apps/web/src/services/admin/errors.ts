/**
 * Errors thrown by services/admin/*.
 */

export class ListingDecisionValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>

  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    super('Invalid listing decision input')
    this.name = 'ListingDecisionValidationError'
    this.issues = issues
  }
}

export class ReportValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>

  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    super('Invalid report input')
    this.name = 'ReportValidationError'
    this.issues = issues
  }
}

export class UserManagementValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserManagementValidationError'
  }
}

export class TargetUserNotFoundError extends Error {
  readonly userId: string

  constructor(userId: string) {
    super(`User not found: ${userId}`)
    this.name = 'TargetUserNotFoundError'
    this.userId = userId
  }
}
