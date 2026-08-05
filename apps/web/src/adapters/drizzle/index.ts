/**
 * adapters/drizzle/
 *
 * Postgres/PostGIS repositories built on Drizzle ORM. Implements
 * ListingReader, ListingWriter and UserRepository (ports/). Only this
 * directory and lib/composition.ts may import drizzle-orm. See PRD §8.1,
 * §8.5, §9.
 */

export { getDb } from './client'
export type { Db } from './client'
export * as schema from './schema'
export {
  DrizzleUserRepository,
  mapRowToUser,
} from './repositories/user-repository'
export {
  DrizzleAgencyRepository,
  mapRowToAgency,
} from './repositories/agency-repository'
export {
  DrizzleListingRepository,
  mapRowToListing,
} from './repositories/listing-repository'
export {
  DrizzlePropertyImageRepository,
  mapRowToPropertyImage,
} from './repositories/property-image-repository'
export {
  geographyPoint,
  citext,
  encodeGeographyPoint,
  decodeGeographyPoint,
} from './custom-types'
