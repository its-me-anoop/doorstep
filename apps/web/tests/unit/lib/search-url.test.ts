import { describe, expect, it } from 'vitest'

import { MAX_HITS_PER_PAGE } from '@/lib/validation/search'
import {
  applyBboxSearch,
  buildMapSearchApiQuery,
  buildSearchApiQuery,
  buildSearchHref,
  hasActiveSearchFilters,
  needsCanonicalRedirect,
  nextSearchParamsToURLSearchParams,
  parseSearchUrlState,
  resetStateForChannelSwitch,
  searchUrlStateToSearchParams,
  stripFiltersKeepLocation,
  type SearchUrlState,
} from '@/lib/search-url'

// M2-DESIGN-SPEC.md §1.7 — the public query-param vocabulary. Every field
// round-trips through the URL (SRCH-1/2's "the search survives URL
// sharing"), and default values (`sort=newest`, `page=1`) are always
// stripped on the way out so two URLs meaning the same thing never both
// get indexed (the canonical-URL rule).

describe('parseSearchUrlState', () => {
  it('returns an empty state for no params', () => {
    expect(parseSearchUrlState(new URLSearchParams())).toEqual({})
  })

  it('parses minPrice and maxPrice as integers', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('minPrice=200000&maxPrice=400000'),
    )
    expect(state.minPrice).toBe(200000)
    expect(state.maxPrice).toBe(400000)
  })

  it('parses minBeds and maxBeds, including 0 (Studio)', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('minBeds=0&maxBeds=3'),
    )
    expect(state.minBeds).toBe(0)
    expect(state.maxBeds).toBe(3)
  })

  it('parses a comma-separated type list, order-insensitively, sorted for stability', () => {
    const state = parseSearchUrlState(new URLSearchParams('type=terraced,flat'))
    expect(state.type).toEqual(['flat', 'terraced'])
  })

  it('drops unrecognised type values rather than erroring', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('type=flat,not_a_real_type'),
    )
    expect(state.type).toEqual(['flat'])
  })

  it('parses a comma-separated furnished list', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('furnished=furnished,unfurnished'),
    )
    expect(state.furnished).toEqual(['furnished', 'unfurnished'])
  })

  it('parses availableFrom as a plain ISO date string', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('availableFrom=2026-09-01'),
    )
    expect(state.availableFrom).toBe('2026-09-01')
  })

  it('ignores a malformed availableFrom date', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('availableFrom=not-a-date'),
    )
    expect(state.availableFrom).toBeUndefined()
  })

  it('parses sort, omitting it from state entirely when it is the default "newest"', () => {
    expect(
      parseSearchUrlState(new URLSearchParams('sort=newest')).sort,
    ).toBeUndefined()
    expect(
      parseSearchUrlState(new URLSearchParams('sort=price_asc')).sort,
    ).toBe('price_asc')
    expect(
      parseSearchUrlState(new URLSearchParams('sort=price_desc')).sort,
    ).toBe('price_desc')
  })

  it('ignores an invalid sort value', () => {
    expect(
      parseSearchUrlState(new URLSearchParams('sort=bogus')).sort,
    ).toBeUndefined()
  })

  it('parses page, omitting it from state entirely when it is the default 1', () => {
    expect(
      parseSearchUrlState(new URLSearchParams('page=1')).page,
    ).toBeUndefined()
    expect(parseSearchUrlState(new URLSearchParams('page=4')).page).toBe(4)
  })

  it('ignores a non-positive or non-integer page', () => {
    expect(
      parseSearchUrlState(new URLSearchParams('page=0')).page,
    ).toBeUndefined()
    expect(
      parseSearchUrlState(new URLSearchParams('page=-1')).page,
    ).toBeUndefined()
    expect(
      parseSearchUrlState(new URLSearchParams('page=abc')).page,
    ).toBeUndefined()
  })

  it('parses lat/lng/radius/label together (the /search tier point)', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('lat=51.454&lng=-0.9788&radius=5&label=RG1%208BT'),
    )
    expect(state.lat).toBe(51.454)
    expect(state.lng).toBe(-0.9788)
    expect(state.radius).toBe(5)
    expect(state.label).toBe('RG1 8BT')
  })

  it('drops lat when lng is missing, and vice versa (must be paired)', () => {
    expect(
      parseSearchUrlState(new URLSearchParams('lat=51.454')).lat,
    ).toBeUndefined()
    expect(
      parseSearchUrlState(new URLSearchParams('lng=-0.9788')).lng,
    ).toBeUndefined()
  })

  it('only accepts one of the spec-listed radius values', () => {
    expect(parseSearchUrlState(new URLSearchParams('radius=5')).radius).toBe(5)
    expect(
      parseSearchUrlState(new URLSearchParams('radius=7')).radius,
    ).toBeUndefined()
  })

  // M3-DESIGN-SPEC.md §1.9 — the map view URL param, layered on the M2
  // vocabulary exactly like every other filter/sort/page param: list is
  // the omitted default, matching the sort=newest/page=1 canonicalisation
  // rule.
  it('parses view=map', () => {
    expect(parseSearchUrlState(new URLSearchParams('view=map')).view).toBe(
      'map',
    )
  })

  it('omits view from state for any value other than "map", including "list"', () => {
    expect(
      parseSearchUrlState(new URLSearchParams('view=list')).view,
    ).toBeUndefined()
    expect(
      parseSearchUrlState(new URLSearchParams('view=bogus')).view,
    ).toBeUndefined()
    expect(parseSearchUrlState(new URLSearchParams('')).view).toBeUndefined()
  })

  // §1.9 — the four bbox corners, reusing the API's own param names
  // verbatim. All four together or none, the same lenient "must be paired"
  // rule §1.7 already applies to lat/lng.
  it('parses all four bbox params together', () => {
    const state = parseSearchUrlState(
      new URLSearchParams(
        'bboxNeLat=51.5&bboxNeLng=-0.9&bboxSwLat=51.4&bboxSwLng=-1.0',
      ),
    )
    expect(state.bboxNeLat).toBe(51.5)
    expect(state.bboxNeLng).toBe(-0.9)
    expect(state.bboxSwLat).toBe(51.4)
    expect(state.bboxSwLng).toBe(-1.0)
  })

  it('drops the bbox entirely when fewer than all four corners are present', () => {
    const state = parseSearchUrlState(
      new URLSearchParams('bboxNeLat=51.5&bboxNeLng=-0.9&bboxSwLat=51.4'),
    )
    expect(state.bboxNeLat).toBeUndefined()
    expect(state.bboxNeLng).toBeUndefined()
    expect(state.bboxSwLat).toBeUndefined()
    expect(state.bboxSwLng).toBeUndefined()
  })

  it('a bbox wins over lat/lng/radius when a URL carries both (§1.9: bbox drops any existing point-radius criteria)', () => {
    const state = parseSearchUrlState(
      new URLSearchParams(
        'lat=51.45&lng=-0.98&radius=5&bboxNeLat=51.5&bboxNeLng=-0.9&bboxSwLat=51.4&bboxSwLng=-1.0',
      ),
    )
    expect(state.bboxNeLat).toBe(51.5)
    expect(state.lat).toBeUndefined()
    expect(state.lng).toBeUndefined()
    expect(state.radius).toBeUndefined()
  })
})

describe('searchUrlStateToSearchParams (canonical serialisation)', () => {
  it('produces an empty query string for an empty state', () => {
    expect(searchUrlStateToSearchParams({}).toString()).toBe('')
  })

  it('never emits sort=newest or page=1 even if explicitly passed', () => {
    const params = searchUrlStateToSearchParams({
      sort: 'newest' as SearchUrlState['sort'],
      page: 1,
    })
    expect(params.toString()).toBe('')
  })

  it('emits a non-default sort and page', () => {
    const params = searchUrlStateToSearchParams({ sort: 'price_asc', page: 3 })
    expect(params.get('sort')).toBe('price_asc')
    expect(params.get('page')).toBe('3')
  })

  it('joins type/furnished arrays as sorted comma-separated values', () => {
    const params = searchUrlStateToSearchParams({
      type: ['terraced', 'flat'],
      furnished: ['unfurnished', 'furnished'],
    })
    expect(params.get('type')).toBe('flat,terraced')
    expect(params.get('furnished')).toBe('furnished,unfurnished')
  })

  it('omits empty arrays entirely', () => {
    const params = searchUrlStateToSearchParams({ type: [] })
    expect(params.has('type')).toBe(false)
  })

  it('round-trips every field through parse -> serialise -> parse', () => {
    const original: SearchUrlState = {
      minPrice: 250000,
      maxPrice: 400000,
      minBeds: 2,
      maxBeds: 4,
      type: ['flat', 'terraced'],
      furnished: ['furnished', 'part_furnished'],
      availableFrom: '2026-09-01',
      sort: 'price_desc',
      page: 2,
      lat: 51.454,
      lng: -0.9788,
      radius: 5,
      label: 'RG1 8BT',
    }
    const params = searchUrlStateToSearchParams(original)
    const reparsed = parseSearchUrlState(params)
    expect(reparsed).toEqual(original)
  })

  it('is stable regardless of the input type array order (cache-key stability)', () => {
    const a = searchUrlStateToSearchParams({ type: ['flat', 'terraced'] })
    const b = searchUrlStateToSearchParams({ type: ['terraced', 'flat'] })
    expect(a.toString()).toBe(b.toString())
  })

  // §1.9
  it('emits view=map only when set', () => {
    expect(searchUrlStateToSearchParams({ view: 'map' }).get('view')).toBe(
      'map',
    )
    expect(searchUrlStateToSearchParams({}).has('view')).toBe(false)
  })

  it('emits all four bbox params together', () => {
    const params = searchUrlStateToSearchParams({
      bboxNeLat: 51.5,
      bboxNeLng: -0.9,
      bboxSwLat: 51.4,
      bboxSwLng: -1.0,
    })
    expect(params.get('bboxNeLat')).toBe('51.5')
    expect(params.get('bboxNeLng')).toBe('-0.9')
    expect(params.get('bboxSwLat')).toBe('51.4')
    expect(params.get('bboxSwLng')).toBe('-1')
  })

  it('round-trips view + bbox alongside filters, sort and page (a view toggle is a lens change, not a new query — §1.9: page is never reset by view alone)', () => {
    const original: SearchUrlState = {
      minBeds: 2,
      sort: 'price_desc',
      page: 3,
      view: 'map',
      bboxNeLat: 51.5,
      bboxNeLng: -0.9,
      bboxSwLat: 51.4,
      bboxSwLng: -1.0,
    }
    const reparsed = parseSearchUrlState(searchUrlStateToSearchParams(original))
    expect(reparsed).toEqual(original)
  })

  it('never emits lat/lng/radius alongside a bbox, even if a caller passes both (defensive parity with the parse-side invariant)', () => {
    const params = searchUrlStateToSearchParams({
      lat: 51.45,
      lng: -0.98,
      radius: 5,
      bboxNeLat: 51.5,
      bboxNeLng: -0.9,
      bboxSwLat: 51.4,
      bboxSwLng: -1.0,
    })
    expect(params.has('lat')).toBe(false)
    expect(params.has('lng')).toBe(false)
    expect(params.has('radius')).toBe(false)
    expect(params.get('bboxNeLat')).toBe('51.5')
  })
})

describe('buildSearchHref', () => {
  it('returns the bare path when state is empty', () => {
    expect(buildSearchHref('/for-sale', {})).toBe('/for-sale')
  })

  it('appends a canonical query string when state has non-default values', () => {
    expect(buildSearchHref('/for-sale', { minBeds: 2 })).toBe(
      '/for-sale?minBeds=2',
    )
  })
})

describe('needsCanonicalRedirect', () => {
  it('returns null when the raw params are already canonical', () => {
    expect(needsCanonicalRedirect(new URLSearchParams('minBeds=2'))).toBeNull()
  })

  it('returns null for a genuinely empty query', () => {
    expect(needsCanonicalRedirect(new URLSearchParams(''))).toBeNull()
  })

  it('returns the canonical query string when default params are present', () => {
    expect(
      needsCanonicalRedirect(new URLSearchParams('sort=newest&page=1')),
    ).toBe('')
  })

  it('returns the canonical query string when a default param sits alongside a real one', () => {
    expect(
      needsCanonicalRedirect(new URLSearchParams('minBeds=2&page=1')),
    ).toBe('minBeds=2')
  })

  it('returns null when params are canonical but ordered differently', () => {
    expect(
      needsCanonicalRedirect(new URLSearchParams('maxBeds=3&minBeds=1')),
    ).toBeNull()
  })

  // §1.9: "a URL with view=list present redirects (301) to the same URL
  // without it" — the same canonicalisation rule as sort=newest/page=1.
  it('redirects a URL carrying view=list to drop it', () => {
    expect(needsCanonicalRedirect(new URLSearchParams('view=list'))).toBe('')
  })

  it('does not redirect a canonical view=map URL', () => {
    expect(needsCanonicalRedirect(new URLSearchParams('view=map'))).toBeNull()
  })

  it('redirects a URL carrying only a partial bbox to drop it', () => {
    expect(
      needsCanonicalRedirect(
        new URLSearchParams('bboxNeLat=51.5&bboxNeLng=-0.9'),
      ),
    ).toBe('')
  })

  it('redirects a URL carrying both a bbox and a lat/lng point to the bbox-only canonical form', () => {
    const canonical = needsCanonicalRedirect(
      new URLSearchParams(
        'lat=51.45&lng=-0.98&bboxNeLat=51.5&bboxNeLng=-0.9&bboxSwLat=51.4&bboxSwLng=-1.0',
      ),
    )
    expect(canonical).not.toBeNull()
    const reparsed = new URLSearchParams(canonical ?? '')
    expect(reparsed.has('lat')).toBe(false)
    expect(reparsed.get('bboxNeLat')).toBe('51.5')
  })
})

describe('buildSearchApiQuery', () => {
  it('maps site vocabulary to the search API vocabulary for a sale query', () => {
    const query = buildSearchApiQuery(
      {
        minPrice: 250000,
        maxPrice: 400000,
        minBeds: 2,
        maxBeds: 4,
        type: ['flat', 'terraced'],
        sort: 'price_asc',
        page: 2,
      },
      'sale',
    )
    expect(query).toEqual({
      channel: 'sale',
      priceMin: '250000',
      priceMax: '400000',
      bedsMin: '2',
      bedsMax: '4',
      types: 'flat,terraced',
      sort: 'price_asc',
      page: '2',
    })
  })

  it('maps lat/lng/radius to the API point-radius vocabulary', () => {
    const query = buildSearchApiQuery(
      { lat: 51.454, lng: -0.9788, radius: 5, label: 'RG1 8BT' },
      'sale',
    )
    expect(query.lat).toBe('51.454')
    expect(query.lng).toBe('-0.9788')
    expect(query.radiusMiles).toBe('5')
    // `label` is display-only copy, not a search API filter.
    expect(query.label).toBeUndefined()
  })

  it('forwards furnished only when exactly one value is selected, since the search API accepts a single value (documented deviation from the multi-select UI)', () => {
    expect(
      buildSearchApiQuery({ furnished: ['furnished'] }, 'rent').furnished,
    ).toBe('furnished')
    expect(
      buildSearchApiQuery({ furnished: ['furnished', 'unfurnished'] }, 'rent')
        .furnished,
    ).toBeUndefined()
    expect(
      buildSearchApiQuery({ furnished: [] }, 'rent').furnished,
    ).toBeUndefined()
  })

  it("maps availableFrom to the API's availableBy param", () => {
    expect(
      buildSearchApiQuery({ availableFrom: '2026-09-01' }, 'rent').availableBy,
    ).toBe('2026-09-01')
  })

  it('omits furnished/availableFrom for a sale query even if present in state (ignore-on-sale rule, §1.7)', () => {
    const query = buildSearchApiQuery(
      { furnished: ['furnished'], availableFrom: '2026-09-01' },
      'sale',
    )
    expect(query.furnished).toBeUndefined()
    expect(query.availableBy).toBeUndefined()
  })

  // §4 — an area landing page scopes every query (initial SSR fetch and
  // every client re-query alike) to its town/outcode, on top of whatever
  // filters the URL itself carries.
  it('adds a town area filter when provided', () => {
    const query = buildSearchApiQuery({ minBeds: 2 }, 'sale', {
      town: 'Reading',
    })
    expect(query.town).toBe('Reading')
    expect(query.bedsMin).toBe('2')
  })

  it('adds an outcode area filter when provided', () => {
    const query = buildSearchApiQuery({}, 'sale', { outcode: 'RG6' })
    expect(query.outcode).toBe('RG6')
  })

  it('omits town/outcode entirely when no area filter is given', () => {
    const query = buildSearchApiQuery({}, 'sale')
    expect(query.town).toBeUndefined()
    expect(query.outcode).toBeUndefined()
  })

  // §1.9 — the bbox forwards verbatim (same param names as the API), and
  // `view` never reaches the API at all (a UI lens, not a search filter).
  it('forwards the bbox verbatim to the API vocabulary', () => {
    const query = buildSearchApiQuery(
      {
        bboxNeLat: 51.5,
        bboxNeLng: -0.9,
        bboxSwLat: 51.4,
        bboxSwLng: -1.0,
      },
      'sale',
    )
    expect(query.bboxNeLat).toBe('51.5')
    expect(query.bboxNeLng).toBe('-0.9')
    expect(query.bboxSwLat).toBe('51.4')
    expect(query.bboxSwLng).toBe('-1')
  })

  it('omits lat/lng/radius from the API query when a bbox is present, even if state carries both (mutual exclusion enforced at the boundary, not just trusted from state)', () => {
    const query = buildSearchApiQuery(
      {
        lat: 51.45,
        lng: -0.98,
        radius: 5,
        bboxNeLat: 51.5,
        bboxNeLng: -0.9,
        bboxSwLat: 51.4,
        bboxSwLng: -1.0,
      },
      'sale',
    )
    expect(query.lat).toBeUndefined()
    expect(query.lng).toBeUndefined()
    expect(query.radiusMiles).toBeUndefined()
    expect(query.bboxNeLat).toBe('51.5')
  })

  it('never forwards view to the search API', () => {
    const query = buildSearchApiQuery({ view: 'map' }, 'sale')
    expect(query.view).toBeUndefined()
  })
})

// M3-DESIGN-SPEC.md §1.3: "The map is never quietly capped to the list's
// current page... the map plots every matching hit in the query" — this
// is the map's own, separate request for that (results-view.tsx calls
// this instead of buildSearchApiQuery for the map pane's own marker-layer
// fetch), independent of the list column's own 24/page window.
describe('buildMapSearchApiQuery', () => {
  it('requests the fetch-window cap via hitsPerPage, and never forwards page — the map is never itself paginated', () => {
    const query = buildMapSearchApiQuery({ page: 3, minBeds: 2 }, 'sale')
    expect(query.hitsPerPage).toBe(String(MAX_HITS_PER_PAGE))
    expect(query.page).toBeUndefined()
    // Every other filter still goes through unchanged — same
    // translation logic as buildSearchApiQuery, just with a different
    // page/hitsPerPage policy layered on top.
    expect(query.bedsMin).toBe('2')
  })

  it('forwards the same filters/bbox/area-scope as buildSearchApiQuery would, for the identical state', () => {
    const state: SearchUrlState = {
      minPrice: 250000,
      bboxNeLat: 51.5,
      bboxNeLng: -0.9,
      bboxSwLat: 51.4,
      bboxSwLng: -1.0,
    }
    const listQuery = buildSearchApiQuery(state, 'sale', { town: 'Reading' })
    const mapQuery = buildMapSearchApiQuery(state, 'sale', { town: 'Reading' })

    // Same query, same criteria — every key except page/hitsPerPage must
    // agree, which is exactly what makes "map and list return identical
    // results for the same criteria" (PRD §13) structural rather than
    // coincidental: both translations share this one function's own
    // filter/bbox logic underneath.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it below
    const { page: _listPage, ...listRest } = listQuery
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it below
    const { hitsPerPage: _mapHitsPerPage, ...mapRest } = mapQuery
    expect(mapRest).toEqual(listRest)
    expect(mapQuery.hitsPerPage).toBe(String(MAX_HITS_PER_PAGE))
  })
})

describe('applyBboxSearch', () => {
  const bbox = { neLat: 51.5, neLng: -0.9, swLat: 51.4, swLng: -1.0 }

  it('sets the four bbox corners and drops any existing lat/lng/radius', () => {
    const result = applyBboxSearch(
      { lat: 51.45, lng: -0.98, radius: 5, label: 'RG1 8BT' },
      bbox,
    )
    expect(result.bboxNeLat).toBe(51.5)
    expect(result.bboxNeLng).toBe(-0.9)
    expect(result.bboxSwLat).toBe(51.4)
    expect(result.bboxSwLng).toBe(-1.0)
    expect(result.lat).toBeUndefined()
    expect(result.lng).toBeUndefined()
    expect(result.radius).toBeUndefined()
  })

  it('resets page to 1 (omitted), mirroring the channel-toggle precedent for a changed geo constraint', () => {
    expect(applyBboxSearch({ page: 4 }, bbox).page).toBeUndefined()
  })

  it('preserves every other field — filters, sort, view and label — a bbox requery narrows where, not what', () => {
    const result = applyBboxSearch(
      {
        minBeds: 2,
        type: ['flat'],
        sort: 'price_asc',
        view: 'map',
        label: 'RG1 8BT',
      },
      bbox,
    )
    expect(result.minBeds).toBe(2)
    expect(result.type).toEqual(['flat'])
    expect(result.sort).toBe('price_asc')
    expect(result.view).toBe('map')
    expect(result.label).toBe('RG1 8BT')
  })
})

describe('hasActiveSearchFilters', () => {
  it('is false for an empty state', () => {
    expect(hasActiveSearchFilters({})).toBe(false)
  })

  it('is false when only sort/page/location are set (not filter chips, §1.1)', () => {
    expect(
      hasActiveSearchFilters({
        sort: 'price_asc',
        page: 2,
        lat: 51.45,
        lng: -0.98,
        radius: 3,
        label: 'RG1 8BT',
      }),
    ).toBe(false)
  })

  it.each<SearchUrlState>([
    { minPrice: 250000 },
    { maxPrice: 400000 },
    { minBeds: 2 },
    { maxBeds: 4 },
    { type: ['flat'] },
    { furnished: ['furnished'] },
    { availableFrom: '2026-09-01' },
  ])('is true when %j is set', (partial) => {
    expect(hasActiveSearchFilters(partial)).toBe(true)
  })

  it('is false when type/furnished are present but empty', () => {
    expect(hasActiveSearchFilters({ type: [], furnished: [] })).toBe(false)
  })
})

describe('nextSearchParamsToURLSearchParams', () => {
  it('converts a plain searchParams object to URLSearchParams', () => {
    const params = nextSearchParamsToURLSearchParams({
      minBeds: '2',
      sort: 'price_asc',
    })
    expect(params.get('minBeds')).toBe('2')
    expect(params.get('sort')).toBe('price_asc')
  })

  it('keeps only the first value of a repeated key', () => {
    const params = nextSearchParamsToURLSearchParams({ minBeds: ['2', '3'] })
    expect(params.get('minBeds')).toBe('2')
  })

  it('skips undefined values', () => {
    const params = nextSearchParamsToURLSearchParams({ minBeds: undefined })
    expect(params.has('minBeds')).toBe(false)
  })
})

describe('stripFiltersKeepLocation', () => {
  it('keeps only lat/lng/radius/label, dropping every filter/sort/page', () => {
    expect(
      stripFiltersKeepLocation({
        lat: 51.454,
        lng: -0.9788,
        radius: 5,
        label: 'RG1 8BT',
        minBeds: 2,
        sort: 'price_asc',
        page: 2,
      }),
    ).toEqual({ lat: 51.454, lng: -0.9788, radius: 5, label: 'RG1 8BT' })
  })

  it('returns an empty state when there is no location to keep', () => {
    expect(stripFiltersKeepLocation({ minBeds: 2 })).toEqual({})
  })
})

describe('resetStateForChannelSwitch', () => {
  // §1.2/§3.2's precise reset rule.
  it('preserves location, beds, type and sort', () => {
    const state: SearchUrlState = {
      lat: 51.454,
      lng: -0.9788,
      radius: 5,
      label: 'RG1 8BT',
      minBeds: 2,
      maxBeds: 4,
      type: ['flat'],
      sort: 'price_asc',
    }
    expect(resetStateForChannelSwitch(state)).toEqual(state)
  })

  it('resets price bounds and page to default (removed from state)', () => {
    const result = resetStateForChannelSwitch({
      minPrice: 250000,
      maxPrice: 400000,
      page: 3,
    })
    expect(result.minPrice).toBeUndefined()
    expect(result.maxPrice).toBeUndefined()
    expect(result.page).toBeUndefined()
  })

  it('drops furnished and availableFrom entirely (channel-specific, meaningless on the other channel)', () => {
    const result = resetStateForChannelSwitch({
      furnished: ['furnished'],
      availableFrom: '2026-09-01',
    })
    expect(result.furnished).toBeUndefined()
    expect(result.availableFrom).toBeUndefined()
  })

  // M3 extension of the M2 rule: `view` is a channel-independent UI lens
  // and a bbox is a location constraint exactly like lat/lng/radius
  // (already preserved above) — both survive a Buy/Rent switch for the
  // same reason location does.
  it('preserves view and bbox across a channel switch', () => {
    const result = resetStateForChannelSwitch({
      view: 'map',
      bboxNeLat: 51.5,
      bboxNeLng: -0.9,
      bboxSwLat: 51.4,
      bboxSwLng: -1.0,
    })
    expect(result.view).toBe('map')
    expect(result.bboxNeLat).toBe(51.5)
    expect(result.bboxNeLng).toBe(-0.9)
    expect(result.bboxSwLat).toBe(51.4)
    expect(result.bboxSwLng).toBe(-1.0)
  })
})
