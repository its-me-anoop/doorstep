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
 * Service groups: auth, listers, listings, geocoding, images, search,
 * searchSync (M0–M3); enquiries, saved, account, admin, analytics,
 * retention (M4–M5). Resend / Upstash / Turnstile adapters are selected
 * via createMailer / createRateLimiter / createCaptchaVerifier — console
 * / in-memory / allow-all fallbacks when credentials are unset so local
 * and CI stay exercisable. See PRD §8.5.
 */

import { getDb } from '@/adapters/drizzle/client'
import { DrizzleAgencyRepository } from '@/adapters/drizzle/repositories/agency-repository'
import { DrizzleAuditLogRepository } from '@/adapters/drizzle/repositories/audit-log-repository'
import { DrizzleEnquiryRepository } from '@/adapters/drizzle/repositories/enquiry-repository'
import { DrizzleEventRepository } from '@/adapters/drizzle/repositories/event-repository'
import { DrizzleListingRepository } from '@/adapters/drizzle/repositories/listing-repository'
import { DrizzleOutboxRepository } from '@/adapters/drizzle/repositories/outbox-repository'
import { DrizzlePropertyImageRepository } from '@/adapters/drizzle/repositories/property-image-repository'
import { DrizzleReportRepository } from '@/adapters/drizzle/repositories/report-repository'
import { DrizzleSavedPropertyRepository } from '@/adapters/drizzle/repositories/saved-property-repository'
import { DrizzleSavedSearchRepository } from '@/adapters/drizzle/repositories/saved-search-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import {
  FirebaseAuthGateway,
  FirebaseStorageAdapter,
} from '@/adapters/firebase'
import { InMemoryTtlGeocodeCache } from '@/adapters/in-memory-geocode-cache'
import { MapboxGeocoder } from '@/adapters/mapbox'
import { MeilisearchSearchIndex } from '@/adapters/meilisearch'
import { PostcodesIoGeocoder } from '@/adapters/postcodesio'
import { createMailer } from '@/adapters/resend'
import { SystemClock } from '@/adapters/system-clock'
import { createCaptchaVerifier } from '@/adapters/turnstile'
import { createRateLimiter } from '@/adapters/upstash'
import type { PlaceSearcher } from '@/ports/geocoder'
import {
  DeleteAccount,
  GetMe,
  UpdateProfile,
} from '@/services/account'
import {
  DecideListing,
  GetMetrics,
  ListAuditLog,
  ListModerationQueue,
  ListOpenReports,
  ManageUser,
  ResolveReport,
  SearchUsers,
  SubmitReport,
  VerifyAgency,
} from '@/services/admin'
import { RecordEvent } from '@/services/analytics'
import {
  EstablishSession,
  GetCurrentUser,
  TerminateSession,
} from '@/services/auth'
import {
  ListListerEnquiries,
  SubmitEnquiry,
  UpdateEnquiryStatus,
} from '@/services/enquiries'
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
  GetPublicListing,
  ListMyListings,
  ListNewestInArea,
  ListPublishedSlugs,
  SubmitListing,
  UpdateListing,
} from '@/services/listings'
import { AnonymiseEnquiries } from '@/services/retention'
import {
  DeleteSavedSearch,
  ListSavedProperties,
  ListSavedSearches,
  SaveProperty,
  SaveSearch,
  UnsaveProperty,
} from '@/services/saved'
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
  getPublicListing: GetPublicListing
  listNewestInArea: ListNewestInArea
  listPublishedSlugs: ListPublishedSlugs
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

export interface EnquiryServices {
  submitEnquiry: SubmitEnquiry
  listListerEnquiries: ListListerEnquiries
  updateEnquiryStatus: UpdateEnquiryStatus
}

export interface SavedServices {
  saveProperty: SaveProperty
  unsaveProperty: UnsaveProperty
  listSavedProperties: ListSavedProperties
  saveSearch: SaveSearch
  listSavedSearches: ListSavedSearches
  deleteSavedSearch: DeleteSavedSearch
}

export interface AccountServices {
  getMe: GetMe
  updateProfile: UpdateProfile
  deleteAccount: DeleteAccount
}

export interface AdminServices {
  decideListing: DecideListing
  listModerationQueue: ListModerationQueue
  manageUser: ManageUser
  searchUsers: SearchUsers
  verifyAgency: VerifyAgency
  getMetrics: GetMetrics
  listAuditLog: ListAuditLog
  submitReport: SubmitReport
  listOpenReports: ListOpenReports
  resolveReport: ResolveReport
}

export interface AnalyticsServices {
  recordEvent: RecordEvent
}

export interface RetentionServices {
  anonymiseEnquiries: AnonymiseEnquiries
}

export interface Services {
  auth: AuthServices
  listers: ListerServices
  listings: ListingServices
  geocoding: GeocodingServices
  images: ImageServices
  search: SearchServices
  searchSync: SearchSyncServices
  enquiries: EnquiryServices
  saved: SavedServices
  account: AccountServices
  admin: AdminServices
  analytics: AnalyticsServices
  retention: RetentionServices
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
 *
 * Rate limiter is also module-scoped when using the in-memory fallback
 * so limits survive across requests in one process (same rationale).
 */
const sharedClock = new SystemClock()
const geocodeCache = new InMemoryTtlGeocodeCache(sharedClock)
const sharedRateLimiter = createRateLimiter(sharedClock)

function listingBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.APP_URL?.replace(/\/$/, '') ||
    'https://doorstep.local'
  )
}

export function createServices(): Services {
  const db = getDb()
  const userRepository = new DrizzleUserRepository(db)
  const agencyRepository = new DrizzleAgencyRepository(db)
  const listingRepository = new DrizzleListingRepository(db)
  const propertyImageRepository = new DrizzlePropertyImageRepository(db)
  const outboxRepository = new DrizzleOutboxRepository(db)
  const enquiryRepository = new DrizzleEnquiryRepository(db)
  const savedPropertyRepository = new DrizzleSavedPropertyRepository(db)
  const savedSearchRepository = new DrizzleSavedSearchRepository(db)
  const auditLogRepository = new DrizzleAuditLogRepository(db)
  const eventRepository = new DrizzleEventRepository(db)
  const reportRepository = new DrizzleReportRepository(db)
  const authGateway = new FirebaseAuthGateway()
  const clock = sharedClock
  const postcodeGeocoder = new PostcodesIoGeocoder()
  const placeSearcher: PlaceSearcher = process.env.MAPBOX_ACCESS_TOKEN
    ? new MapboxGeocoder()
    : postcodeGeocoder
  const imageStorage = new FirebaseStorageAdapter()
  const searchIndex = new MeilisearchSearchIndex()
  const mailer = createMailer()
  const rateLimiter = sharedRateLimiter
  const captchaVerifier = createCaptchaVerifier()
  const baseUrl = listingBaseUrl()

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
      getPublicListing: new GetPublicListing(
        listingRepository,
        propertyImageRepository,
        agencyRepository,
        imageStorage,
      ),
      listNewestInArea: new ListNewestInArea(
        listingRepository,
        propertyImageRepository,
        agencyRepository,
        imageStorage,
      ),
      listPublishedSlugs: new ListPublishedSlugs(listingRepository),
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
    enquiries: {
      submitEnquiry: new SubmitEnquiry(
        listingRepository,
        userRepository,
        agencyRepository,
        enquiryRepository,
        mailer,
        rateLimiter,
        captchaVerifier,
        clock,
        { listingBaseUrl: baseUrl },
      ),
      listListerEnquiries: new ListListerEnquiries(enquiryRepository),
      updateEnquiryStatus: new UpdateEnquiryStatus(
        enquiryRepository,
        enquiryRepository,
        listingRepository,
      ),
    },
    saved: {
      saveProperty: new SaveProperty(
        savedPropertyRepository,
        listingRepository,
      ),
      unsaveProperty: new UnsaveProperty(savedPropertyRepository),
      listSavedProperties: new ListSavedProperties(
        savedPropertyRepository,
        listingRepository,
        propertyImageRepository,
      ),
      saveSearch: new SaveSearch(savedSearchRepository),
      listSavedSearches: new ListSavedSearches(savedSearchRepository),
      deleteSavedSearch: new DeleteSavedSearch(savedSearchRepository),
    },
    account: {
      getMe: new GetMe(userRepository),
      updateProfile: new UpdateProfile(userRepository),
      deleteAccount: new DeleteAccount(
        userRepository,
        listingRepository,
        listingRepository,
        enquiryRepository,
        savedPropertyRepository,
        savedSearchRepository,
        authGateway,
        clock,
      ),
    },
    admin: {
      decideListing: new DecideListing(
        listingRepository,
        listingRepository,
        userRepository,
        auditLogRepository,
        mailer,
        clock,
        { listingBaseUrl: baseUrl },
      ),
      listModerationQueue: new ListModerationQueue(listingRepository),
      manageUser: new ManageUser(
        userRepository,
        listingRepository,
        listingRepository,
        auditLogRepository,
        authGateway,
        clock,
      ),
      searchUsers: new SearchUsers(userRepository),
      verifyAgency: new VerifyAgency(agencyRepository, auditLogRepository),
      getMetrics: new GetMetrics(
        listingRepository,
        userRepository,
        eventRepository,
      ),
      listAuditLog: new ListAuditLog(auditLogRepository),
      submitReport: new SubmitReport(reportRepository),
      listOpenReports: new ListOpenReports(reportRepository),
      resolveReport: new ResolveReport(reportRepository, auditLogRepository),
    },
    analytics: {
      recordEvent: new RecordEvent(eventRepository),
    },
    retention: {
      anonymiseEnquiries: new AnonymiseEnquiries(enquiryRepository, clock),
    },
  }
}
