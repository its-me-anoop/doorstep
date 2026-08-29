import { describe, expect, it } from 'vitest'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { ForbiddenError } from '@/services/authz/policies'
import { DecideListing } from '@/services/admin/decide-listing'
import { ListingDecisionValidationError } from '@/services/admin/errors'

import { FakeClock, FakeUserRepository } from '../auth/fakes'
import { FakeListingRepository } from '../listings/fakes'
import { FakeAuditLogRepository } from './fakes'
import { FakeMailer } from '../enquiries/fakes'

function admin(): User {
  return {
    id: 'admin-1',
    firebaseUid: 'firebase-admin',
    email: 'admin@doorstep.test',
    displayName: 'Admin',
    phone: null,
    role: 'admin',
    agencyId: null,
    status: 'active',
  }
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'lister-1',
    agencyId: null,
    channel: 'sale',
    status: 'pending_review',
    propertyType: 'semi_detached',
    slug: '3-bed-semi-abc',
    title: '3 bed semi for sale',
    description: 'Lovely home.',
    features: [],
    bedrooms: 3,
    bathrooms: 1,
    price: 250_000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '1 Road',
    displayAddress: 'Road, Reading',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.45, lng: -0.98 },
    locationApproximate: false,
    publishedAt: null,
    statusChangedAt: new Date('2026-01-01T00:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function sut() {
  const listings = new FakeListingRepository()
  const users = new FakeUserRepository()
  const audit = new FakeAuditLogRepository()
  const mailer = new FakeMailer()
  const clock = new FakeClock(new Date('2026-02-01T12:00:00Z'))

  const service = new DecideListing(
    listings,
    listings,
    users,
    audit,
    mailer,
    clock,
  )

  return { listings, users, audit, mailer, service }
}

describe('DecideListing', () => {
  it('approves a pending listing, writes outbox upsert, audits, and emails the lister', async () => {
    const { listings, users, audit, mailer, service } = sut()
    listings.seed(listing())
    users.seed({
      id: 'lister-1',
      firebaseUid: 'firebase-lister',
      email: 'lister@example.co.uk',
      displayName: 'Lister',
      phone: null,
      role: 'owner',
      agencyId: null,
      status: 'active',
    })

    const updated = await service.execute(admin(), {
      listingId: 'listing-1',
      decision: 'approve',
    })

    expect(updated.status).toBe('published')
    expect(updated.publishedAt).toEqual(new Date('2026-02-01T12:00:00Z'))
    expect(updated.rejectionReason).toBeNull()
    expect(listings.outboxWrites).toEqual([
      { propertyId: 'listing-1', op: 'upsert' },
    ])
    expect(audit.entries).toHaveLength(1)
    expect(audit.entries[0]?.action).toBe('listing.approve')
    expect(mailer.sent[0]?.template).toBe('listing-approved')
  })

  it('rejects with a reason and writes no outbox row', async () => {
    const { listings, users, audit, mailer, service } = sut()
    listings.seed(listing())
    users.seed({
      id: 'lister-1',
      firebaseUid: 'firebase-lister',
      email: 'lister@example.co.uk',
      displayName: 'Lister',
      phone: null,
      role: 'owner',
      agencyId: null,
      status: 'active',
    })

    const updated = await service.execute(admin(), {
      listingId: 'listing-1',
      decision: 'reject',
      rejectionReason: 'Poor photos',
    })

    expect(updated.status).toBe('rejected')
    expect(updated.rejectionReason).toBe('Poor photos')
    expect(listings.outboxWrites).toEqual([])
    expect(audit.entries[0]?.action).toBe('listing.reject')
    expect(mailer.sent[0]?.template).toBe('listing-rejected')
  })

  it('requires a rejection reason', async () => {
    const { listings, service } = sut()
    listings.seed(listing())

    await expect(
      service.execute(admin(), {
        listingId: 'listing-1',
        decision: 'reject',
      }),
    ).rejects.toBeInstanceOf(ListingDecisionValidationError)
  })

  it('rejects non-admin actors', async () => {
    const { listings, service } = sut()
    listings.seed(listing())

    const owner: User = {
      id: 'lister-1',
      firebaseUid: 'firebase-lister',
      email: 'lister@example.co.uk',
      displayName: 'Lister',
      phone: null,
      role: 'owner',
      agencyId: null,
      status: 'active',
    }

    await expect(
      service.execute(owner, {
        listingId: 'listing-1',
        decision: 'approve',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws InvalidTransitionError when the listing is not pending review', async () => {
    const { listings, service } = sut()
    listings.seed(listing({ status: 'published', publishedAt: new Date() }))

    await expect(
      service.execute(admin(), {
        listingId: 'listing-1',
        decision: 'approve',
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError)
  })
})
