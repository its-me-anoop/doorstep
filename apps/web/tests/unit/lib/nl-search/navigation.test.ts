import { describe, expect, it } from 'vitest'

import {
  buildNaturalLanguageSearchTarget,
  hrefForNaturalLanguageSearch,
} from '@/lib/nl-search/navigation'
import type { TypeaheadSuggestion } from '@/lib/typeahead-suggestions'

// Plain-English search navigation — layers parsed filters onto the
// existing route/URL helpers (geocode-navigation.ts, search-url.ts) so
// the result is always a URL the ordinary filter bar could have built.

const READING_POSTCODE: TypeaheadSuggestion = {
  kind: 'postcode',
  label: 'RG1 8BT',
  lat: 51.454,
  lng: -0.9788,
  outcode: 'RG1',
}

const BASINGSTOKE: TypeaheadSuggestion = {
  kind: 'place',
  name: 'Basingstoke',
  label: 'Basingstoke, Hampshire',
  lat: 51.27,
  lng: -1.09,
  outcode: null,
}

const CAVERSHAM_AREA: TypeaheadSuggestion = {
  kind: 'area',
  slug: 'caversham',
  label: 'Caversham',
}

describe('hrefForNaturalLanguageSearch (from the hero)', () => {
  it("searches the channel's unrestricted tier when there is no place", () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { minBeds: 2, maxPrice: 350_000, type: ['flat'] },
        channel: 'sale',
      }),
    ).toBe('/for-sale?maxPrice=350000&minBeds=2&type=flat')
  })

  it('uses the rent prefix for the rent channel', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { furnished: ['unfurnished'] },
        channel: 'rent',
      }),
    ).toBe('/to-rent?furnished=unfurnished')
  })

  it('routes a curated area to the area page and appends the filters', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { minBeds: 2, type: ['flat'] },
        channel: 'sale',
        suggestion: CAVERSHAM_AREA,
      }),
    ).toBe('/for-sale/caversham?minBeds=2&type=flat')
  })

  it('routes a postcode to the /search point tier with the default radius', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { maxPrice: 1_500 },
        channel: 'rent',
        suggestion: READING_POSTCODE,
      }),
    ).toBe(
      '/to-rent/search?maxPrice=1500&lat=51.454&lng=-0.9788&radius=3&label=RG1+8BT',
    )
  })

  it('lets a spoken radius override the default one — only where there is a point', () => {
    expect(
      buildNaturalLanguageSearchTarget({
        filters: { radius: 10 },
        channel: 'sale',
        suggestion: BASINGSTOKE,
      }).state.radius,
    ).toBe(10)

    expect(
      buildNaturalLanguageSearchTarget({
        filters: { radius: 10 },
        channel: 'sale',
        suggestion: CAVERSHAM_AREA,
      }).state.radius,
    ).toBeUndefined()

    expect(
      buildNaturalLanguageSearchTarget({
        filters: { radius: 10 },
        channel: 'sale',
      }).state.radius,
    ).toBeUndefined()
  })

  it('treats an unresolved place (null) exactly like no place', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { minBeds: 3 },
        channel: 'sale',
        suggestion: null,
      }),
    ).toBe('/for-sale?minBeds=3')
  })

  it('carries sort and map view through', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { sort: 'price_asc', view: 'map' },
        channel: 'sale',
      }),
    ).toBe('/for-sale?sort=price_asc&view=map')
  })
})

describe('hrefForNaturalLanguageSearch (refining a results page)', () => {
  const current = {
    channel: 'sale' as const,
    basePath: '/for-sale/caversham',
    state: { minBeds: 2, maxPrice: 400_000, page: 3 },
  }

  it('merges new filters into the current state, keeps the page route, resets page', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { type: ['flat'], maxPrice: 350_000 },
        channel: 'sale',
        current,
      }),
    ).toBe('/for-sale/caversham?maxPrice=350000&minBeds=2&type=flat')
  })

  it('replaces the location when a new place resolves, keeping the filters', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: {},
        channel: 'sale',
        suggestion: BASINGSTOKE,
        current: {
          channel: 'sale',
          basePath: '/for-sale/search',
          state: {
            minBeds: 2,
            lat: 51.45,
            lng: -0.97,
            radius: 3,
            label: 'RG1 8BT',
          },
        },
      }),
    ).toBe(
      '/for-sale/search?minBeds=2&lat=51.27&lng=-1.09&radius=5&label=Basingstoke%2C+Hampshire',
    )
  })

  it('drops an active bbox when a new place resolves', () => {
    const target = buildNaturalLanguageSearchTarget({
      filters: {},
      channel: 'sale',
      suggestion: CAVERSHAM_AREA,
      current: {
        channel: 'sale',
        basePath: '/for-sale/search',
        state: {
          bboxNeLat: 1,
          bboxNeLng: 1,
          bboxSwLat: 0,
          bboxSwLng: 0,
          view: 'map',
        },
      },
    })
    expect(target.basePath).toBe('/for-sale/caversham')
    expect(target.state).toEqual({ view: 'map' })
  })

  it('applies the channel-switch reset rule when the sentence moves Buy → Rent', () => {
    expect(
      hrefForNaturalLanguageSearch({
        filters: { maxPrice: 1_500, furnished: ['furnished'] },
        channel: 'rent',
        current: {
          channel: 'sale',
          basePath: '/for-sale/caversham',
          state: { minBeds: 2, maxPrice: 400_000, type: ['flat'], page: 2 },
        },
      }),
    ).toBe(
      '/to-rent/caversham?maxPrice=1500&minBeds=2&type=flat&furnished=furnished',
    )
  })
})
