import { beforeAll, describe, expect, it } from 'vitest'

// Cheap regression net: these are type-only exports, so this test can't
// check values — it checks that the barrel module resolves and that a
// runtime value from lib/composition (which depends on the same port
// types) is shaped the way callers expect. A future agent adding
// concrete adapters can extend this into an ISP contract-test suite.
import { createServices } from '@/lib/composition'

describe('ports barrel', () => {
  it('resolves without throwing', async () => {
    await expect(import('@/ports')).resolves.toBeDefined()
  })

  describe('createServices()', () => {
    // getDb() (adapters/drizzle/client.ts) reads DATABASE_URL the first
    // time it's called, which createServices() does eagerly. There is no
    // live database in this environment (per PRD, no local Postgres or
    // Firebase project), but getDb() itself never opens a connection —
    // the underlying `postgres` client is lazy — so a syntactically
    // valid placeholder is enough to prove createServices() wires
    // everything up without touching the network. Firebase env vars are
    // never read here because FirebaseAuthGateway only calls
    // getAdminApp() from inside a method, not its constructor.
    beforeAll(() => {
      process.env.DATABASE_URL ??=
        'postgres://user:password@localhost:5432/doorstep'
    })

    it('wires the auth service group', () => {
      const services = createServices()

      expect(services.auth.establishSession).toBeDefined()
      expect(services.auth.terminateSession).toBeDefined()
      expect(services.auth.getCurrentUser).toBeDefined()
    })

    it('wires the listers service group', () => {
      const services = createServices()

      expect(services.listers.becomeOwner).toBeDefined()
      expect(services.listers.createAgency).toBeDefined()
    })

    it('wires the listings service group', () => {
      const services = createServices()

      expect(services.listings.createListingDraft).toBeDefined()
      expect(services.listings.updateListing).toBeDefined()
      expect(services.listings.submitListing).toBeDefined()
      expect(services.listings.changeListingStatus).toBeDefined()
      expect(services.listings.getListing).toBeDefined()
      expect(services.listings.listMyListings).toBeDefined()
      expect(services.listings.getPublicListing).toBeDefined()
      expect(services.listings.listNewestInArea).toBeDefined()
    })

    it('wires the geocoding service group', () => {
      const services = createServices()

      expect(services.geocoding.searchGeocode).toBeDefined()
    })

    it('wires the images service group', () => {
      const services = createServices()

      expect(services.images.requestImageUpload).toBeDefined()
      expect(services.images.processImage).toBeDefined()
      expect(services.images.reorderImages).toBeDefined()
      expect(services.images.setImageKind).toBeDefined()
      expect(services.images.deleteImage).toBeDefined()
    })

    it('wires the search-sync service group', () => {
      const services = createServices()

      expect(services.searchSync.drainOutbox).toBeDefined()
      expect(services.searchSync.rebuildSearchIndex).toBeDefined()
    })

    it('wires the search service group', () => {
      const services = createServices()

      expect(services.search.searchListings).toBeDefined()
    })

    it('wires the enquiries service group', () => {
      const services = createServices()

      expect(services.enquiries.submitEnquiry).toBeDefined()
      expect(services.enquiries.listListerEnquiries).toBeDefined()
      expect(services.enquiries.updateEnquiryStatus).toBeDefined()
    })

    it('wires the saved service group', () => {
      const services = createServices()

      expect(services.saved.saveProperty).toBeDefined()
      expect(services.saved.unsaveProperty).toBeDefined()
      expect(services.saved.listSavedProperties).toBeDefined()
      expect(services.saved.saveSearch).toBeDefined()
      expect(services.saved.listSavedSearches).toBeDefined()
      expect(services.saved.deleteSavedSearch).toBeDefined()
    })

    it('wires the account service group', () => {
      const services = createServices()

      expect(services.account.getMe).toBeDefined()
      expect(services.account.updateProfile).toBeDefined()
      expect(services.account.deleteAccount).toBeDefined()
    })

    it('wires the admin service group', () => {
      const services = createServices()

      expect(services.admin.decideListing).toBeDefined()
      expect(services.admin.listModerationQueue).toBeDefined()
      expect(services.admin.manageUser).toBeDefined()
      expect(services.admin.searchUsers).toBeDefined()
      expect(services.admin.verifyAgency).toBeDefined()
      expect(services.admin.getMetrics).toBeDefined()
      expect(services.admin.listAuditLog).toBeDefined()
      expect(services.admin.submitReport).toBeDefined()
      expect(services.admin.listOpenReports).toBeDefined()
      expect(services.admin.resolveReport).toBeDefined()
    })

    it('wires the analytics service group', () => {
      const services = createServices()

      expect(services.analytics.recordEvent).toBeDefined()
    })

    it('wires the retention service group', () => {
      const services = createServices()

      expect(services.retention.anonymiseEnquiries).toBeDefined()
    })
  })
})
