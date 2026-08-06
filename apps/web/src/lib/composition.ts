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
 * (CreateListingDraft, UpdateListing, SubmitListing, ChangeListingStatus,
 * ListMyListings, DeleteListing — PRD §6.5 LST-2/4/5, M1-DESIGN-SPEC.md §4)
 * the third — all three share the one DrizzleListingRepository instance,
 * since it implements both ListingReader and ListingWriter. `geocoding`
 * (SearchGeocode — PRD §8.6, §10 SRCH-1) is the fourth: PostcodesIoGeocoder
 * is always the `PostcodeGeocoder` (the postcode fast path); the
 * `PlaceSearcher` half is MapboxGeocoder when MAPBOX_ACCESS_TOKEN is set,
 * else the same PostcodesIoGeocoder instance falls back to its own
 * `searchPlaces` (see adapters/mapbox/'s doc comment for the documented
 * PRD deviation this represents). `geocodeCache` is constructed at MODULE
 * scope below, not inside this function — see the comment beside that
 * declaration for why. `images`
 * (RequestImageUpload, ProcessImage, ReorderImages, SetImageKind,
 * DeleteImage, ListListingImages, GetCoverBlurhashes — PRD §6.5 LST-3,
 * §8.7) is the fifth, wired to FirebaseStorageAdapter and the new
 * DrizzlePropertyImageRepository; FirebaseStorageAdapter's constructor
 * reads no env var itself (see that class's doc comment) so this
 * function's own eager-construction-of-everything shape still never
 * throws for a service group a given request doesn't touch. `searchSync`
 * (DrainOutbox, RebuildSearchIndex — PRD §8.6's outbox drain worker and
 * nightly reindex) is the sixth, wired to the new DrizzleOutboxRepository
 * and MeilisearchSearchIndex; the latter's constructor is lazy in the
 * same way (reads MEILISEARCH_HOST only once a method actually runs), so
 * it holds the same "never throws for an untouched service group"
 * property. `search` (SearchListings — the use case behind GET
 * /api/v1/search, PRD §10) is the seventh, sharing that same
 * MeilisearchSearchIndex instance — this key was renamed from its
 * previous `search` (which only ever meant search-*sync*) to `searchSync`
 * when this query-side group was added, freeing `search` for the public
 * query use case; app/api/cron/outbox-drain and app/api/cron/reindex were
 * updated to call `searchSync.*` accordingly. Later milestones add a
 * concrete adapter per port here as each remaining integration (Resend,
 * Upstash) lands. See PRD §8.5.
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
import { DrizzleOutboxRepository } from '@/adapters/drizzle/repositories/outbox-repository'
import { DrizzlePropertyImageRepository } from '@/adapters/drizzle/repositories/property-image-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import {
  FirebaseAuthGateway,
  FirebaseStorageAdapter,
} from '@/adapters/firebase'
import { InMemoryTtlGeocodeCache } from '@/adapters/in-memory-geocode-cache'
import { MapboxGeocoder } from '@/adapters/mapbox'
import { MeilisearchSearchIndex } from '@/adapters/meilisearch'
import { PostcodesIoGeocoder } from '@/adapters/postcodesio'
import { SystemClock } from '@/adapters/system-clock'
import type { PlaceSearcher } from '@/ports/geocoder'
import {
  EstablishSession,
  GetCurrentUser,
  TerminateSession,
} from '@/services/auth'
import { SearchGeocode } from '@/services/geocoding'
import {
  DeleteImage,
  GetCoverBlurhashes,
  ListListingImages,
  ProcessImage,
  ReorderImages,
  RequestImageUpload,
  SetImageKind,
} from '@/services/images'
import { BecomeOwner, CreateAgency } from '@/services/listers'
import {
  ChangeListingStatus,
  CreateListingDraft,
  DeleteListing,
  GetListing,
  ListMyListings,
  SubmitListing,
  UpdateListing,
} from '@/services/listings'
import { SearchListings } from '@/services/search'
import { DrainOutbox, RebuildSearchIndex } from '@/services/search-sync'

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
  deleteListing: DeleteListing
}

export interface GeocodingServices {
  searchGeocode: SearchGeocode
}

export interface ImageServices {
  requestImageUpload: RequestImageUpload
  processImage: ProcessImage
  reorderImages: ReorderImages
  setImageKind: SetImageKind
  deleteImage: DeleteImage
  listListingImages: ListListingImages
  getCoverBlurhashes: GetCoverBlurhashes
}

export interface SearchSyncServices {
  drainOutbox: DrainOutbox
  rebuildSearchIndex: RebuildSearchIndex
}

export interface SearchServices {
  searchListings: SearchListings
}

export interface Services {
  auth: AuthServices
  listers: ListerServices
  listings: ListingServices
  geocoding: GeocodingServices
  images: ImageServices
  search: SearchServices
  searchSync: SearchSyncServices
}

/**
 * Constructed once at module scope, NOT inside createServices() —
 * InMemoryTtlGeocodeCache's whole value is entries surviving across
 * requests within one warm server process (see that adapter's doc
 * comment); a fresh instance per createServices() call (as every other
 * adapter here deliberately is, for statelessness) would cache nothing
 * across requests and defeat the point entirely. SystemClock is a
 * dependency, not a shared resource, so it's fine to construct once
 * here rather than reusing the one createServices() builds per call.
 */
const geocodeCache = new InMemoryTtlGeocodeCache(new SystemClock())

export function createServices(): Services {
  const userRepository = new DrizzleUserRepository(getDb())
  const agencyRepository = new DrizzleAgencyRepository(getDb())
  const listingRepository = new DrizzleListingRepository(getDb())
  const propertyImageRepository = new DrizzlePropertyImageRepository(getDb())
  const outboxRepository = new DrizzleOutboxRepository(getDb())
  const authGateway = new FirebaseAuthGateway()
  const clock = new SystemClock()
  const postcodeGeocoder = new PostcodesIoGeocoder()
  // Mapbox is the PRD's named free-text provider, used only when a token
  // is configured; postcodes.io's own Places API is the default
  // otherwise — see adapters/mapbox/'s doc comment for the documented
  // deviation this represents.
  const placeSearcher: PlaceSearcher = process.env.MAPBOX_ACCESS_TOKEN
    ? new MapboxGeocoder()
    : postcodeGeocoder
  const imageStorage = new FirebaseStorageAdapter()
  const searchIndex = new MeilisearchSearchIndex()

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
        propertyImageRepository,
        clock,
      ),
      changeListingStatus: new ChangeListingStatus(
        listingRepository,
        listingRepository,
        clock,
      ),
      getListing: new GetListing(listingRepository),
      listMyListings: new ListMyListings(listingRepository),
      deleteListing: new DeleteListing(listingRepository, listingRepository),
    },
    geocoding: {
      searchGeocode: new SearchGeocode(
        postcodeGeocoder,
        placeSearcher,
        geocodeCache,
      ),
    },
    images: {
      requestImageUpload: new RequestImageUpload(
        listingRepository,
        propertyImageRepository,
        imageStorage,
      ),
      processImage: new ProcessImage(
        listingRepository,
        propertyImageRepository,
        propertyImageRepository,
        imageStorage,
      ),
      reorderImages: new ReorderImages(
        listingRepository,
        propertyImageRepository,
        propertyImageRepository,
      ),
      setImageKind: new SetImageKind(
        listingRepository,
        propertyImageRepository,
        propertyImageRepository,
      ),
      deleteImage: new DeleteImage(
        listingRepository,
        propertyImageRepository,
        propertyImageRepository,
        imageStorage,
      ),
      listListingImages: new ListListingImages(
        listingRepository,
        propertyImageRepository,
        imageStorage,
      ),
      getCoverBlurhashes: new GetCoverBlurhashes(propertyImageRepository),
    },
    search: {
      searchListings: new SearchListings(searchIndex),
    },
    searchSync: {
      drainOutbox: new DrainOutbox(
        outboxRepository,
        listingRepository,
        propertyImageRepository,
        agencyRepository,
        imageStorage,
        searchIndex,
      ),
      rebuildSearchIndex: new RebuildSearchIndex(
        listingRepository,
        propertyImageRepository,
        agencyRepository,
        imageStorage,
        searchIndex,
      ),
    },
  }
}
