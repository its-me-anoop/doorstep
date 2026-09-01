/**
 * Errors thrown by services/account/*.
 */

export class ProfileValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>

  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    super('Invalid profile input')
    this.name = 'ProfileValidationError'
    this.issues = issues
  }
}
