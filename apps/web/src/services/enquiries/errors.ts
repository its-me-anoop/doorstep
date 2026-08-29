/**
 * Errors thrown by services/enquiries/*. Route handlers map these to the
 * PRD §8.5 { error: { code, message } } envelope (or a silent 200 for
 * honeypot trips).
 */

export class RateLimitedError extends Error {
  readonly resetAt: Date

  constructor(resetAt: Date) {
    super('Too many enquiries — try again later.')
    this.name = 'RateLimitedError'
    this.resetAt = resetAt
  }
}

export class CaptchaFailedError extends Error {
  constructor() {
    super('CAPTCHA verification failed — please try again.')
    this.name = 'CaptchaFailedError'
  }
}

export class ListingNotEnquirableError extends Error {
  readonly listingId: string

  constructor(listingId: string) {
    super('This listing is not accepting enquiries.')
    this.name = 'ListingNotEnquirableError'
    this.listingId = listingId
  }
}

/**
 * Thrown when the honeypot field is filled. Routes map this to a fake
 * 200 success so bots cannot learn they were caught.
 */
export class HoneypotTriggeredError extends Error {
  constructor() {
    super('Honeypot triggered')
    this.name = 'HoneypotTriggeredError'
  }
}

export class EnquiryValidationError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>

  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    super('Invalid enquiry input')
    this.name = 'EnquiryValidationError'
    this.issues = issues
  }
}
