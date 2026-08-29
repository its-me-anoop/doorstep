import { describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import {
  CaptchaFailedError,
  HoneypotTriggeredError,
  ListingNotEnquirableError,
  RateLimitedError,
} from '@/services/enquiries/errors'
import { SubmitEnquiry } from '@/services/enquiries/submit-enquiry'

import { FakeClock, FakeUserRepository } from '../auth/fakes'
import { FakeListingRepository } from '../listings/fakes'
import {
  FakeCaptchaVerifier,
  FakeEnquiryRepository,
  FakeMailer,
  FakeRateLimiter,
} from './fakes'

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'lister-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
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
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    statusChangedAt: new Date('2026-01-01T00:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function lister(): User {
  return {
    id: 'lister-1',
    firebaseUid: 'firebase-lister',
    email: 'lister@example.co.uk',
    displayName: 'Lister Example',
    phone: null,
    role: 'owner',
    agencyId: null,
    status: 'active',
  }
}

function sut() {
  const listings = new FakeListingRepository()
  const users = new FakeUserRepository()
  const enquiries = new FakeEnquiryRepository()
  const mailer = new FakeMailer()
  const rateLimiter = new FakeRateLimiter()
  const captcha = new FakeCaptchaVerifier()
  const clock = new FakeClock(new Date('2026-02-01T12:00:00Z'))

  const service = new SubmitEnquiry(
    listings,
    users,
    { findById: async () => null } as never,
    enquiries,
    mailer,
    rateLimiter,
    captcha,
    clock,
    { listingBaseUrl: 'https://doorstep.test' },
  )

  return { listings, users, enquiries, mailer, rateLimiter, captcha, service }
}

describe('SubmitEnquiry', () => {
  it('creates an enquiry, emails lister and enquirer, and marks delivered for a guest', async () => {
    const { listings, users, enquiries, mailer, service } = sut()
    listings.seed(listing())
    users.seed(lister())

    const result = await service.execute(null, {
      propertyId: 'listing-1',
      name: 'Jamie Buyer',
      email: 'buyer@example.co.uk',
      phone: '07700900000',
      message: 'Is this still available please?',
      viewingRequested: true,
      captchaToken: 'valid-token',
      remoteIp: '203.0.113.1',
    })

    expect(result.propertyId).toBe('listing-1')
    expect(result.deliveredAt).toEqual(new Date('2026-02-01T12:00:00Z'))
    expect(mailer.sent).toHaveLength(2)
    expect(mailer.sent[0]).toMatchObject({
      to: 'lister@example.co.uk',
      template: 'enquiry-to-lister',
      data: expect.objectContaining({ replyTo: 'buyer@example.co.uk' }),
    })
    expect(mailer.sent[1]).toMatchObject({
      to: 'buyer@example.co.uk',
      template: 'enquiry-receipt',
    })
    expect(enquiries.anonymisedForUser).toEqual([])
  })

  it('skips captcha for signed-in users', async () => {
    const { listings, users, captcha, service } = sut()
    listings.seed(listing())
    users.seed(lister())
    captcha.valid = false

    const actor: User = {
      id: 'buyer-1',
      firebaseUid: 'firebase-buyer',
      email: 'buyer@example.co.uk',
      displayName: 'Jamie Buyer',
      phone: null,
      role: 'user',
      agencyId: null,
      status: 'active',
    }

    await expect(
      service.execute(actor, {
        propertyId: 'listing-1',
        name: 'Jamie Buyer',
        email: 'buyer@example.co.uk',
        message: 'Still available?',
      }),
    ).resolves.toBeDefined()
  })

  it('throws HoneypotTriggeredError when the honeypot is filled', async () => {
    const { listings, users, service } = sut()
    listings.seed(listing())
    users.seed(lister())

    await expect(
      service.execute(null, {
        propertyId: 'listing-1',
        name: 'Bot',
        email: 'bot@spam.test',
        message: 'spam message here',
        website: 'http://spam.test',
        captchaToken: 'token',
      }),
    ).rejects.toBeInstanceOf(HoneypotTriggeredError)
  })

  it('throws RateLimitedError when the IP limit is exceeded', async () => {
    const { listings, users, rateLimiter, service } = sut()
    listings.seed(listing())
    users.seed(lister())
    rateLimiter.limit = 0

    await expect(
      service.execute(null, {
        propertyId: 'listing-1',
        name: 'Jamie Buyer',
        email: 'buyer@example.co.uk',
        message: 'Is this still available please?',
        captchaToken: 'valid-token',
        remoteIp: '203.0.113.1',
      }),
    ).rejects.toBeInstanceOf(RateLimitedError)
  })

  it('throws CaptchaFailedError for guests without a valid token', async () => {
    const { listings, users, captcha, service } = sut()
    listings.seed(listing())
    users.seed(lister())
    captcha.valid = false

    await expect(
      service.execute(null, {
        propertyId: 'listing-1',
        name: 'Jamie Buyer',
        email: 'buyer@example.co.uk',
        message: 'Is this still available please?',
        captchaToken: 'bad-token',
      }),
    ).rejects.toBeInstanceOf(CaptchaFailedError)
  })

  it('throws ListingNotEnquirableError when the listing is not live', async () => {
    const { listings, users, service } = sut()
    listings.seed(listing({ status: 'hidden' }))
    users.seed(lister())

    await expect(
      service.execute(null, {
        propertyId: 'listing-1',
        name: 'Jamie Buyer',
        email: 'buyer@example.co.uk',
        message: 'Is this still available please?',
        captchaToken: 'valid-token',
      }),
    ).rejects.toBeInstanceOf(ListingNotEnquirableError)
  })
})
