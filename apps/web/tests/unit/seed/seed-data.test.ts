import { describe, expect, it } from 'vitest'

import {
  channelEnum,
  councilTaxBandEnum,
  epcRatingEnum,
  furnishedEnum,
  imageKindEnum,
  priceQualifierEnum,
  propertyStatusEnum,
  propertyTypeEnum,
  tenureEnum,
} from '@/adapters/drizzle/schema'

import {
  SEED_AGENCIES,
  SEED_PROPERTIES,
  SEED_USERS,
} from '../../../scripts/seed-data'

// Fixtures for the local-dev seed script (chore(seed) task). These tests
// guard the data itself, not a DB round trip — there is no live database
// on this machine, so seed.ts (which inserts these rows) is exercised for
// real only in CI's integration job. Enum membership is checked against
// the actual Drizzle pgEnum().enumValues arrays so this suite can never
// drift from the schema it feeds.

const READING_BOUNDING_BOX = {
  minLat: 51.4,
  maxLat: 51.55,
  minLng: -1.1,
  maxLng: -0.85,
}

const DECLARED_STATUS_DISTRIBUTION: Record<string, number> = {
  published: 15,
  under_offer: 3,
  pending_review: 1,
  draft: 1,
}

function isInSet(enumObj: { enumValues: readonly string[] }, value: unknown) {
  return typeof value === 'string' && enumObj.enumValues.includes(value)
}

describe('seed-data fixtures', () => {
  describe('agencies', () => {
    it('has exactly 3 agencies with unique slugs', () => {
      expect(SEED_AGENCIES).toHaveLength(3)
      const slugs = SEED_AGENCIES.map((a) => a.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    })

    it('every agency has a plausible phone, email, website and address', () => {
      for (const agency of SEED_AGENCIES) {
        expect(agency.phone.length).toBeGreaterThan(0)
        expect(agency.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/)
        expect(agency.website).toMatch(/^https:\/\//)
        expect(agency.address.length).toBeGreaterThan(0)
      }
    })

    it('every agency createdByEmail resolves to a seeded user', () => {
      const emails = new Set(SEED_USERS.map((u) => u.email))
      for (const agency of SEED_AGENCIES) {
        expect(emails.has(agency.createdByEmail)).toBe(true)
      }
    })
  })

  describe('users', () => {
    it('has exactly 4 users: 2 agents, 1 owner, 1 plain user', () => {
      expect(SEED_USERS).toHaveLength(4)
      const roles = SEED_USERS.map((u) => u.role).sort()
      expect(roles).toEqual(['agent', 'agent', 'owner', 'user'])
    })

    it('every user has a unique firebase_uid clearly marked seed-only', () => {
      const uids = SEED_USERS.map((u) => u.firebaseUid)
      expect(new Set(uids).size).toBe(uids.length)
      for (const uid of uids) {
        expect(uid).toMatch(/^seed-/)
      }
    })

    it('every agent references a real seeded agency slug', () => {
      const agencySlugs = new Set(SEED_AGENCIES.map((a) => a.slug))
      for (const user of SEED_USERS) {
        if (user.role === 'agent') {
          expect(user.agencySlug).not.toBeNull()
          expect(agencySlugs.has(user.agencySlug as string)).toBe(true)
        } else {
          expect(user.agencySlug).toBeNull()
        }
      }
    })
  })

  describe('properties', () => {
    it('has exactly 20 properties', () => {
      expect(SEED_PROPERTIES).toHaveLength(20)
    })

    it('has unique slugs', () => {
      const slugs = SEED_PROPERTIES.map((p) => p.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    })

    it('is a mix of 12 sale and 8 rent listings', () => {
      const sale = SEED_PROPERTIES.filter((p) => p.channel === 'sale')
      const rent = SEED_PROPERTIES.filter((p) => p.channel === 'rent')
      expect(sale).toHaveLength(12)
      expect(rent).toHaveLength(8)
    })

    it('matches the declared status distribution', () => {
      const counts: Record<string, number> = {}
      for (const p of SEED_PROPERTIES) {
        counts[p.status] = (counts[p.status] ?? 0) + 1
      }
      expect(counts).toEqual(DECLARED_STATUS_DISTRIBUTION)
    })

    it('keeps sale prices in the £240,000–£850,000 range', () => {
      for (const p of SEED_PROPERTIES.filter((p) => p.channel === 'sale')) {
        expect(p.price).toBeGreaterThanOrEqual(240_000)
        expect(p.price).toBeLessThanOrEqual(850_000)
        expect(Number.isInteger(p.price)).toBe(true)
      }
    })

    it('keeps rent prices in the £950–£2,400 pcm range', () => {
      for (const p of SEED_PROPERTIES.filter((p) => p.channel === 'rent')) {
        expect(p.price).toBeGreaterThanOrEqual(950)
        expect(p.price).toBeLessThanOrEqual(2_400)
        expect(Number.isInteger(p.price)).toBe(true)
      }
    })

    it('sets tenure for sale listings only', () => {
      for (const p of SEED_PROPERTIES) {
        if (p.channel === 'sale') {
          expect(p.tenure).not.toBeNull()
        } else {
          expect(p.tenure).toBeNull()
        }
      }
    })

    it('sets furnished, availableFrom and deposit for rent listings only', () => {
      for (const p of SEED_PROPERTIES) {
        if (p.channel === 'rent') {
          expect(p.furnished).not.toBeNull()
          expect(p.availableFrom).not.toBeNull()
          expect(p.deposit).not.toBeNull()
          expect(Number.isInteger(p.deposit)).toBe(true)
        } else {
          expect(p.furnished).toBeNull()
          expect(p.availableFrom).toBeNull()
          expect(p.deposit).toBeNull()
        }
      }
    })

    it('sets an epc_rating for every rental, per PRD §12', () => {
      for (const p of SEED_PROPERTIES.filter((p) => p.channel === 'rent')) {
        expect(p.epcRating).not.toBeNull()
        expect(isInSet(epcRatingEnum, p.epcRating)).toBe(true)
      }
    })

    it('keeps bedrooms within 0–5 and includes exactly one studio', () => {
      const studios = SEED_PROPERTIES.filter((p) => p.bedrooms === 0)
      expect(studios).toHaveLength(1)
      for (const p of SEED_PROPERTIES) {
        expect(p.bedrooms).toBeGreaterThanOrEqual(0)
        expect(p.bedrooms).toBeLessThanOrEqual(5)
      }
    })

    it('places every property inside the Reading/Thames Valley bounding box', () => {
      for (const p of SEED_PROPERTIES) {
        expect(p.location.lat).toBeGreaterThanOrEqual(
          READING_BOUNDING_BOX.minLat,
        )
        expect(p.location.lat).toBeLessThanOrEqual(READING_BOUNDING_BOX.maxLat)
        expect(p.location.lng).toBeGreaterThanOrEqual(
          READING_BOUNDING_BOX.minLng,
        )
        expect(p.location.lng).toBeLessThanOrEqual(READING_BOUNDING_BOX.maxLng)
      }
    })

    it('never exposes address_line1 through displayAddress', () => {
      for (const p of SEED_PROPERTIES) {
        expect(p.displayAddress).not.toContain(p.addressLine1)
      }
    })

    it('has a title matching the PRD title pattern', () => {
      for (const p of SEED_PROPERTIES) {
        expect(p.title).toMatch(
          /^(?:\d+ bed|Studio) [a-z-]+(?: house)? for (?:sale|rent)$/,
        )
      }
    })

    it('has at most 10 features, all non-empty strings', () => {
      for (const p of SEED_PROPERTIES) {
        expect(p.features.length).toBeGreaterThan(0)
        expect(p.features.length).toBeLessThanOrEqual(10)
        for (const feature of p.features) {
          expect(feature.length).toBeGreaterThan(0)
        }
      }
    })

    it('every listerEmail resolves to a seeded user', () => {
      const emails = new Set(SEED_USERS.map((u) => u.email))
      for (const p of SEED_PROPERTIES) {
        expect(emails.has(p.listerEmail)).toBe(true)
      }
    })

    it('every non-null agencySlug resolves to a seeded agency', () => {
      const slugs = new Set(SEED_AGENCIES.map((a) => a.slug))
      for (const p of SEED_PROPERTIES) {
        if (p.agencySlug !== null) {
          expect(slugs.has(p.agencySlug)).toBe(true)
        }
      }
    })

    it('sets publishedAt for published/under_offer listings and not for pending_review/draft', () => {
      for (const p of SEED_PROPERTIES) {
        if (p.status === 'published' || p.status === 'under_offer') {
          expect(p.publishedAt).not.toBeNull()
        } else {
          expect(p.publishedAt).toBeNull()
        }
      }
    })

    it('every enum field is a real value from the Drizzle schema enum', () => {
      for (const p of SEED_PROPERTIES) {
        expect(isInSet(channelEnum, p.channel)).toBe(true)
        expect(isInSet(propertyStatusEnum, p.status)).toBe(true)
        expect(isInSet(propertyTypeEnum, p.propertyType)).toBe(true)
        expect(isInSet(priceQualifierEnum, p.priceQualifier)).toBe(true)
        if (p.tenure !== null) {
          expect(isInSet(tenureEnum, p.tenure)).toBe(true)
        }
        if (p.furnished !== null) {
          expect(isInSet(furnishedEnum, p.furnished)).toBe(true)
        }
        if (p.councilTaxBand !== null) {
          expect(isInSet(councilTaxBandEnum, p.councilTaxBand)).toBe(true)
        }
        for (const image of p.images) {
          expect(isInSet(imageKindEnum, image.kind)).toBe(true)
        }
      }
    })

    it('gives every non-draft property 3–5 images with a photo cover at position 0', () => {
      for (const p of SEED_PROPERTIES) {
        if (p.status === 'draft') {
          expect(p.images).toHaveLength(0)
          continue
        }
        expect(p.images.length).toBeGreaterThanOrEqual(3)
        expect(p.images.length).toBeLessThanOrEqual(5)
        expect(p.images[0]?.kind).toBe('photo')
        expect(p.images[0]?.position).toBe(0)
        const positions = p.images.map((img) => img.position)
        expect(positions).toEqual([...positions].sort((a, b) => a - b))
        expect(new Set(positions).size).toBe(positions.length)
        for (const image of p.images) {
          expect(image.width).toBeGreaterThan(0)
          expect(image.height).toBeGreaterThan(0)
          expect(image.blurhash.length).toBeGreaterThanOrEqual(20)
          expect(image.storagePath).toMatch(/^https:\/\//)
        }
      }
    })
  })
})
