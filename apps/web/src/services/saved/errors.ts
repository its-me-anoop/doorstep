/**
 * Errors thrown by services/saved/*.
 */

export class SavedListingNotFoundError extends Error {
  readonly propertyId: string

  constructor(propertyId: string) {
    super('Listing not found')
    this.name = 'SavedListingNotFoundError'
    this.propertyId = propertyId
  }
}

export class SavedSearchForbiddenError extends Error {
  constructor() {
    super('You do not own this saved search')
    this.name = 'SavedSearchForbiddenError'
  }
}
