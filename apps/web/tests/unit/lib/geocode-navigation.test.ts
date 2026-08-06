import { describe, expect, it } from 'vitest'

import { hrefForGeocodeSuggestion } from '@/lib/geocode-navigation'

// M2-DESIGN-SPEC.md §1.9 — where selecting a suggestion navigates.
describe('hrefForGeocodeSuggestion', () => {
  it('navigates a postcode match to /search with a default 3-mile radius', () => {
    const href = hrefForGeocodeSuggestion(
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.454,
        lng: -0.9788,
        outcode: 'RG1',
      },
      'sale',
    )
    expect(href).toBe(
      '/for-sale/search?lat=51.454&lng=-0.9788&radius=3&label=RG1+8BT',
    )
  })

  it('navigates a place match to /search with a default 5-mile radius', () => {
    const href = hrefForGeocodeSuggestion(
      {
        kind: 'place',
        name: 'Manchester',
        label: 'Manchester, England',
        lat: 53.48,
        lng: -2.24,
        outcode: null,
      },
      'sale',
    )
    expect(href).toBe(
      '/for-sale/search?lat=53.48&lng=-2.24&radius=5&label=Manchester%2C+England',
    )
  })

  it('routes a place matching a curated area exactly to the area landing page instead', () => {
    const href = hrefForGeocodeSuggestion(
      {
        kind: 'place',
        name: 'Caversham',
        label: 'Caversham, Reading, Berkshire',
        lat: 51.47,
        lng: -0.97,
        outcode: null,
      },
      'sale',
    )
    expect(href).toBe('/for-sale/caversham')
  })

  it('uses the /to-rent prefix for the rent channel', () => {
    const href = hrefForGeocodeSuggestion(
      {
        kind: 'place',
        name: 'Wokingham',
        label: 'Wokingham, Berkshire',
        lat: 51.41,
        lng: -0.83,
        outcode: null,
      },
      'rent',
    )
    expect(href).toBe('/to-rent/wokingham')
  })

  it('does not area-match on a partial/non-exact label', () => {
    const href = hrefForGeocodeSuggestion(
      {
        kind: 'place',
        name: 'Caversham Heights',
        label: 'Caversham Heights, Reading',
        lat: 51.47,
        lng: -0.98,
        outcode: null,
      },
      'sale',
    )
    expect(href).toContain('/for-sale/search?')
  })
})
