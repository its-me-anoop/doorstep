import { describe, expect, it } from 'vitest'

import { hitsToFeatureCollection } from '@/components/features/search/map/geojson'
import type { PublicSearchHit } from '@/services/search/search-listings'

function hit(overrides: Partial<PublicSearchHit> = {}): PublicSearchHit {
  return {
    id: 'pr_1',
    slug: 'slug-1',
    channel: 'sale',
    title: 'A home',
    displayAddress: 'Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG30',
    propertyType: 'flat',
    bedrooms: 2,
    bathrooms: 1,
    price: 350_000,
    priceQualifier: 'fixed',
    displayStatus: 'published',
    furnished: null,
    availableFrom: null,
    newHome: false,
    coverImageUrl: null,
    imageCount: 0,
    agency: null,
    publishedAt: 0,
    geo: { lat: 51.454, lng: -0.9788 },
    ...overrides,
  }
}

// M3-DESIGN-SPEC.md §1.2/§1.3 — the map's own data shape: a plain
// GeoJSON FeatureCollection of Points, one per hit, carrying only what a
// pin needs to render itself. A pin's own full detail (price/address/
// beds/type for the mini card, M2's identical `PublicSearchHit` fields)
// is looked up by id from the same in-memory result set the list already
// holds — this mapper is deliberately not a second, fuller DTO.
describe('hitsToFeatureCollection', () => {
  it('produces a valid GeoJSON FeatureCollection of Points, one per hit', () => {
    const fc = hitsToFeatureCollection([hit(), hit({ id: 'pr_2' })])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(2)
    expect(fc.features[0].type).toBe('Feature')
    expect(fc.features[0].geometry.type).toBe('Point')
  })

  it('orders coordinates as [lng, lat], the GeoJSON convention', () => {
    const fc = hitsToFeatureCollection([
      hit({ geo: { lat: 51.454, lng: -0.9788 } }),
    ])
    expect(fc.features[0].geometry.coordinates).toEqual([-0.9788, 51.454])
  })

  it('carries the hit id so a pin click can look the full hit back up', () => {
    const fc = hitsToFeatureCollection([hit({ id: 'pr_42' })])
    expect(fc.features[0].properties.hitId).toBe('pr_42')
  })

  it('labels a published sale listing with the compact abbreviated price', () => {
    const fc = hitsToFeatureCollection([
      hit({
        price: 350_000,
        priceQualifier: 'fixed',
        displayStatus: 'published',
      }),
    ])
    expect(fc.features[0].properties.label).toBe('£350k')
    expect(fc.features[0].properties.underOffer).toBe(false)
  })

  it('labels a published rent listing with the full pcm figure', () => {
    const fc = hitsToFeatureCollection([
      hit({
        channel: 'rent',
        price: 1_300,
        priceQualifier: 'fixed',
        displayStatus: 'published',
      }),
    ])
    expect(fc.features[0].properties.label).toBe('£1,300 pcm')
  })

  it('shows POA instead of a price for a poa-qualified listing', () => {
    const fc = hitsToFeatureCollection([
      hit({ priceQualifier: 'poa', displayStatus: 'published' }),
    ])
    expect(fc.features[0].properties.label).toBe('POA')
  })

  // §1.2: under-offer pins show only the status word, never a price —
  // reusing the same displayStatus precedence ResultCard's own
  // freshnessOrStatusBadge already applies (displayStatus is the literal
  // "published" for a live listing, else the friendly status label).
  it('flags an under-offer listing and labels it with the status word only, never a price', () => {
    const fc = hitsToFeatureCollection([
      hit({ displayStatus: 'Sold STC', price: 350_000 }),
    ])
    expect(fc.features[0].properties.underOffer).toBe(true)
    expect(fc.features[0].properties.label).toBe('Sold STC')
  })

  it('flags a Let Agreed rent listing the same way', () => {
    const fc = hitsToFeatureCollection([
      hit({ channel: 'rent', displayStatus: 'Let Agreed', price: 1_300 }),
    ])
    expect(fc.features[0].properties.underOffer).toBe(true)
    expect(fc.features[0].properties.label).toBe('Let Agreed')
  })

  it('returns an empty FeatureCollection for zero hits', () => {
    expect(hitsToFeatureCollection([])).toEqual({
      type: 'FeatureCollection',
      features: [],
    })
  })
})
