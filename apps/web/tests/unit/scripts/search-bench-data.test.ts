import { describe, expect, it } from 'vitest'

import {
  channelEnum,
  councilTaxBandEnum,
  epcRatingEnum,
  furnishedEnum,
  priceQualifierEnum,
  propertyTypeEnum,
  tenureEnum,
} from '@/adapters/drizzle/schema'

import {
  BENCH_LISTER_FIREBASE_UID,
  generateBenchProperties,
  THAMES_VALLEY_TOWNS,
} from '../../../scripts/search-bench-data'

// scripts/search-bench-data.ts's pure generator (M2 bench evidence task).
// There is no live database on this machine — as with
// tests/unit/seed/seed-data.test.ts, this suite guards the generated data
// itself; scripts/seed-search-5k.ts (which inserts it) is exercised for
// real only by running it against a live dev database.

function isInSet(enumObj: { enumValues: readonly string[] }, value: unknown) {
  return typeof value === 'string' && enumObj.enumValues.includes(value)
}

describe('THAMES_VALLEY_TOWNS', () => {
  it('has ~15 real Thames Valley towns, each with a plausible GB centroid and outcode', () => {
    expect(THAMES_VALLEY_TOWNS.length).toBeGreaterThanOrEqual(15)
    const outcodes = THAMES_VALLEY_TOWNS.map((t) => t.outcode)
    expect(new Set(outcodes).size).toBe(outcodes.length)
    for (const town of THAMES_VALLEY_TOWNS) {
      expect(town.name.length).toBeGreaterThan(0)
      expect(town.outcode).toMatch(/^[A-Z]{1,2}\d[A-Z\d]?$/)
      expect(town.lat).toBeGreaterThan(51)
      expect(town.lat).toBeLessThan(52)
      expect(town.lng).toBeGreaterThan(-2)
      expect(town.lng).toBeLessThan(0)
    }
  })
})

describe('generateBenchProperties', () => {
  it('generates exactly the requested count', () => {
    const properties = generateBenchProperties(200)
    expect(properties).toHaveLength(200)
  })

  it('is deterministic — two calls produce byte-identical output', () => {
    const a = generateBenchProperties(500)
    const b = generateBenchProperties(500)
    expect(a).toEqual(b)
  })

  it('every property is published, references the bench lister, and has a unique slug', () => {
    const properties = generateBenchProperties(300)
    const slugs = new Set(properties.map((p) => p.slug))
    expect(slugs.size).toBe(properties.length)
    for (const property of properties) {
      expect(property.status).toBe('published')
      expect(property.listerEmail).toBe(
        `${BENCH_LISTER_FIREBASE_UID}@bench.doorstep.test`,
      )
      expect(property.publishedAt).not.toBeNull()
    }
  })

  it('every enum-typed field is a real value from the Drizzle schema enum', () => {
    const properties = generateBenchProperties(1000)
    for (const property of properties) {
      expect(isInSet(channelEnum, property.channel)).toBe(true)
      expect(isInSet(propertyTypeEnum, property.propertyType)).toBe(true)
      expect(isInSet(priceQualifierEnum, property.priceQualifier)).toBe(true)
      expect(
        property.tenure === null || isInSet(tenureEnum, property.tenure),
      ).toBe(true)
      expect(
        property.furnished === null ||
          isInSet(furnishedEnum, property.furnished),
      ).toBe(true)
      expect(isInSet(epcRatingEnum, property.epcRating)).toBe(true)
      expect(isInSet(councilTaxBandEnum, property.councilTaxBand)).toBe(true)
    }
  })

  it('tenure is set for sale only; furnished is set for rent only', () => {
    const properties = generateBenchProperties(1000)
    for (const property of properties) {
      if (property.channel === 'sale') {
        expect(property.tenure).not.toBeNull()
        expect(property.furnished).toBeNull()
      } else {
        expect(property.furnished).not.toBeNull()
      }
    }
  })

  it('covers every property type across a large enough sample', () => {
    const properties = generateBenchProperties(2000)
    const types = new Set(properties.map((p) => p.propertyType))
    expect(types.size).toBe(propertyTypeEnum.enumValues.length)
  })

  it('covers both channels across a large enough sample', () => {
    const properties = generateBenchProperties(500)
    const channels = new Set(properties.map((p) => p.channel))
    expect(channels).toEqual(new Set(['sale', 'rent']))
  })

  it('covers every furnished value across a large enough rent sample', () => {
    const properties = generateBenchProperties(2000)
    const furnishedValues = new Set(
      properties.filter((p) => p.channel === 'rent').map((p) => p.furnished),
    )
    expect(furnishedValues.size).toBe(furnishedEnum.enumValues.length)
  })

  it('some listings are marked newHome and some are not', () => {
    const properties = generateBenchProperties(500)
    expect(properties.some((p) => p.newHome)).toBe(true)
    expect(properties.some((p) => !p.newHome)).toBe(true)
  })

  it('geo jitter keeps every listing within a few km of its town centroid', () => {
    const properties = generateBenchProperties(500)
    for (const property of properties) {
      const town = THAMES_VALLEY_TOWNS.find(
        (t) => t.outcode === property.outcode,
      )
      expect(town).toBeDefined()
      if (!town) continue
      expect(Math.abs(property.location.lat - town.lat)).toBeLessThan(0.05)
      expect(Math.abs(property.location.lng - town.lng)).toBeLessThan(0.05)
    }
  })

  it('bedrooms and bathrooms are non-negative integers', () => {
    const properties = generateBenchProperties(500)
    for (const property of properties) {
      expect(Number.isInteger(property.bedrooms)).toBe(true)
      expect(property.bedrooms).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(property.bathrooms)).toBe(true)
      expect(property.bathrooms).toBeGreaterThanOrEqual(1)
    }
  })

  it('price is a positive integer', () => {
    const properties = generateBenchProperties(500)
    for (const property of properties) {
      expect(Number.isInteger(property.price)).toBe(true)
      expect(property.price).toBeGreaterThan(0)
    }
  })
})
