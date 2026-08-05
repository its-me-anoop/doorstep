/**
 * services/
 *
 * Use cases (PublishListing, SubmitEnquiry, ApproveListing, ...) that
 * orchestrate one or more ports to fulfil a single application action. Each
 * service has one responsibility (SRP). Services depend only on port
 * interfaces (DIP) — never on adapters/ or framework types — so they can be
 * unit tested with in-memory fakes.
 *
 * auth/ (EstablishSession, TerminateSession, GetCurrentUser) and authz/
 * (canManageListing, requireRole) are the first use cases to land — see
 * PRD §8.4. listers/ (BecomeOwner, CreateAgency) is the lister-onboarding
 * flow — PRD §6.5 LST-1. listings/ (CreateListingDraft, UpdateListing,
 * SubmitListing, ChangeListingStatus) is the create-listing wizard's data
 * side — PRD §6.5 LST-2, LST-4, LST-5. geocoding/ (SearchGeocode) is the
 * public postcode-suggestions lookup — PRD §8.6, §10.
 *
 * See PRD §8.5.
 */

export {
  EstablishSession,
  SESSION_COOKIE_LIFETIME_MS,
  TerminateSession,
  GetCurrentUser,
  AccountSuspendedError,
  UnknownSessionUserError,
} from './auth'
export type {
  EstablishSessionInput,
  EstablishSessionResult,
  GetCurrentUserResult,
} from './auth'

export { ForbiddenError, canManageListing, requireRole } from './authz'
export type { Actor, ListingSubject } from './authz'

export { BecomeOwner, CreateAgency } from './listers'
export type { BecomeOwnerResult, CreateAgencyResult } from './listers'

export {
  CreateListingDraft,
  UpdateListing,
  SubmitListing,
  PHOTO_MINIMUM,
  ChangeListingStatus,
  GetListing,
  ListMyListings,
  ListingNotEditableError,
  ListingChannelImmutableError,
  ListingIncompleteError,
  ListingActionChannelMismatchError,
} from './listings'
export type { ListingStatusAction } from './listings'

export { SearchGeocode } from './geocoding'
