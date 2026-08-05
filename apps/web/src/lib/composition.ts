/**
 * lib/composition.ts — the composition root.
 *
 * This is the one place allowed to import concrete adapters (adapters/*)
 * and wire them into ports (ports/), then hand the resulting services
 * (services/) to callers. Route handlers and server components call
 * `createServices()` and depend on the returned shape, never on an
 * adapter directly (DIP). The ESLint config in this package enforces
 * that boundary: app/** may not import from adapters/** except through
 * this file.
 *
 * `auth` is the first group of services wired here (EstablishSession,
 * TerminateSession, GetCurrentUser — PRD §8.4). `listers` (BecomeOwner,
 * CreateAgency — PRD §6.5 LST-1) is the second, `listings`
 * (CreateListingDraft, UpdateListing, SubmitListing, ChangeListingStatus —
 * PRD §6.5 LST-2/4/5) the third — all three share the one
 * DrizzleListingRepository instance, since it implements both
 * ListingReader and ListingWriter. `geocoding` (SearchGeocode — PRD §8.6,
 * §10) is the fourth, wired to PostcodesIoGeocoder: the postcode fast
 * path only for M1 — see that adapter's doc comment for the Mapbox
 * fallback TODO(M2). Later milestones add a concrete adapter per port
 * here as each remaining integration (Meilisearch, Storage, Resend,
 * Mapbox, Upstash) lands. See PRD §8.5.
 *
 * Note: this constructs a DrizzleUserRepository, which calls
 * adapters/drizzle/client.ts's getDb() — that throws if DATABASE_URL
 * isn't set. That's expected: createServices() is meant to be called at
 * request time (inside a route handler or server component), by which
 * point the environment is configured, not at module-import time or in
 * a unit test — see tests/unit/ports/barrel.test.ts for how tests that
 * merely need createServices() to construct without a live database
 * satisfy that.
 */

import { getDb } from '@/adapters/drizzle/client'
import { DrizzleAgencyRepository } from '@/adapters/drizzle/repositories/agency-repository'
import { DrizzleListingRepository } from '@/adapters/drizzle/repositories/listing-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import { FirebaseAuthGateway } from '@/adapters/firebase'
import { PostcodesIoGeocoder } from '@/adapters/postcodesio'
import { SystemClock } from '@/adapters/system-clock'
import {
  EstablishSession,
  GetCurrentUser,
  TerminateSession,
} from '@/services/auth'
import { SearchGeocode } from '@/services/geocoding'
import { BecomeOwner, CreateAgency } from '@/services/listers'
import {
  ChangeListingStatus,
  CreateListingDraft,
  GetListing,
  ListMyListings,
  SubmitListing,
  UpdateListing,
} from '@/services/listings'

export interface AuthServices {
  establishSession: EstablishSession
  terminateSession: TerminateSession
  getCurrentUser: GetCurrentUser
}

export interface ListerServices {
  becomeOwner: BecomeOwner
  createAgency: CreateAgency
}

export interface ListingServices {
  createListingDraft: CreateListingDraft
  updateListing: UpdateListing
  submitListing: SubmitListing
  changeListingStatus: ChangeListingStatus
  getListing: GetListing
  listMyListings: ListMyListings
}

export interface GeocodingServices {
  searchGeocode: SearchGeocode
}

export interface Services {
  auth: AuthServices
  listers: ListerServices
  listings: ListingServices
  geocoding: GeocodingServices
}

export function createServices(): Services {
  const userRepository = new DrizzleUserRepository(getDb())
  const agencyRepository = new DrizzleAgencyRepository(getDb())
  const listingRepository = new DrizzleListingRepository(getDb())
  const authGateway = new FirebaseAuthGateway()
  const clock = new SystemClock()
  const geocoder = new PostcodesIoGeocoder()

  return {
    auth: {
      establishSession: new EstablishSession(
        authGateway,
        userRepository,
        clock,
      ),
      terminateSession: new TerminateSession(authGateway),
      getCurrentUser: new GetCurrentUser(authGateway, userRepository, clock),
    },
    listers: {
      becomeOwner: new BecomeOwner(userRepository, authGateway),
      createAgency: new CreateAgency(
        agencyRepository,
        userRepository,
        authGateway,
      ),
    },
    listings: {
      createListingDraft: new CreateListingDraft(listingRepository),
      updateListing: new UpdateListing(listingRepository, listingRepository),
      submitListing: new SubmitListing(
        listingRepository,
        listingRepository,
        clock,
      ),
      changeListingStatus: new ChangeListingStatus(
        listingRepository,
        listingRepository,
        clock,
      ),
      getListing: new GetListing(listingRepository),
      listMyListings: new ListMyListings(listingRepository),
    },
    geocoding: {
      searchGeocode: new SearchGeocode(geocoder),
    },
  }
}
