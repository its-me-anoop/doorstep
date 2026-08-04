/**
 * ports/
 *
 * The interfaces domain/ and services/ are allowed to depend on:
 * ListingRepository (split as ListingReader/ListingWriter per ISP),
 * UserRepository, SearchIndex, ImageStorage, Mailer, Geocoder,
 * RateLimiter, Clock. Adapters implement these; the composition root
 * (lib/composition.ts) wires a concrete adapter to each port. Nothing in
 * this directory imports Next.js, Drizzle, Firebase, or any other
 * framework/vendor package (DIP). See PRD §8.5, §8.6.
 */

export type {
  Listing,
  ListingId,
  ListingStatus,
  ListingChannel,
  ListingReader,
  ListingWriter,
} from './listing-repository'
export type {
  User,
  UserRole,
  UserStatus,
  UserRepository,
} from './user-repository'
export type {
  GeoPoint,
  SearchDocument,
  SearchFilters,
  SearchResult,
  SearchIndex,
} from './search-index'
export type { SignedUploadUrl, ImageStorage } from './image-storage'
export type { EmailMessage, Mailer } from './mailer'
export type { GeocodeResult, Geocoder } from './geocoder'
export type { RateLimitResult, RateLimiter } from './rate-limiter'
export type { Clock } from './clock'
export type { DecodedIdentity, RoleClaims, AuthGateway } from './auth-gateway'
