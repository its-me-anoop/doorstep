import { describe, expect, it } from 'vitest'

import {
  AREAS,
  areaMatchToFilter,
  findAreaBySlug,
  findAreasMatchingListing,
} from '@/lib/areas'

// Thames Valley bounding box — generous enough to cover every curated
// area (Reading through Wokingham) without being so wide it'd also pass
// for, say, Manchester. Registry-integrity net only, not a precision geo
// check (M2-DESIGN-SPEC.md §1.7: area matching is administrative
// town/outcode, never geo-radius).
const THAMES_VALLEY_BBOX = {
  minLat: 51.3,
  maxLat: 51.6,
  minLng: -1.2,
  maxLng: -0.7,
}

describe('AREAS registry', () => {
  it('has exactly the seven curated slugs from M2-DESIGN-SPEC.md §1.7', () => {
    expect(AREAS.map((area) => area.slug).sort()).toEqual(
      [
        'caversham',
        'earley',
        'emmer-green',
        'reading',
        'tilehurst',
        'wokingham',
        'woodley',
      ].sort(),
    )
  })

  it('has unique slugs', () => {
    const slugs = AREAS.map((area) => area.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('has unique labels', () => {
    const labels = AREAS.map((area) => area.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('centres every area inside the Thames Valley bounding box', () => {
    for (const area of AREAS) {
      expect(area.centre.lat).toBeGreaterThanOrEqual(THAMES_VALLEY_BBOX.minLat)
      expect(area.centre.lat).toBeLessThanOrEqual(THAMES_VALLEY_BBOX.maxLat)
      expect(area.centre.lng).toBeGreaterThanOrEqual(THAMES_VALLEY_BBOX.minLng)
      expect(area.centre.lng).toBeLessThanOrEqual(THAMES_VALLEY_BBOX.maxLng)
    }
  })

  it('gives every area a positive radius', () => {
    for (const area of AREAS) {
      expect(area.radiusMiles).toBeGreaterThan(0)
    }
  })

  it('gives every area its own non-templated intro paragraph (§4.1)', () => {
    const intros = AREAS.map((area) => area.intro)
    expect(new Set(intros).size).toBe(intros.length)
    for (const intro of intros) {
      expect(intro.length).toBeGreaterThan(80)
    }
  })
})

describe('findAreaBySlug', () => {
  it('finds an area by its slug', () => {
    expect(findAreaBySlug('reading')?.label).toBe('Reading')
  })

  it('returns undefined for an unknown slug', () => {
    expect(findAreaBySlug('manchester')).toBeUndefined()
  })
})

describe('areaMatchToFilter', () => {
  it('projects a town match to { town }', () => {
    expect(areaMatchToFilter({ town: 'Reading' })).toEqual({ town: 'Reading' })
  })

  it('projects an outcode match to { outcode }', () => {
    expect(areaMatchToFilter({ outcode: 'RG6' })).toEqual({ outcode: 'RG6' })
  })
})

describe('findAreasMatchingListing', () => {
  it('matches Reading by town, not solely by an outcode that also appears under another town', () => {
    // The seeded dev database has town="Reading" listings in both RG1 and
    // RG4 — RG4 alone would also match Caversham/Sonning, so Reading must
    // resolve by town, not outcode (this module's own doc comment on why
    // the spec's illustrative outcode table was revised against real
    // data). It also, correctly, still surfaces on Emmer Green's page —
    // that overlap is the documented, known gap (RG4 has no per-listing
    // signal finer than "Reading vs Caversham town"), not a bug this test
    // should hide.
    const areas = findAreasMatchingListing('Reading', 'RG4')
    expect(areas.map((area) => area.slug).sort()).toEqual([
      'emmer-green',
      'reading',
    ])
  })

  it('matches Caversham by town, with the documented Emmer Green RG4 overlap', () => {
    const areas = findAreasMatchingListing('Caversham', 'RG4')
    expect(areas.map((area) => area.slug).sort()).toEqual([
      'caversham',
      'emmer-green',
    ])
  })

  it('matches Earley by outcode, catching the "Lower Earley" town variant too', () => {
    expect(
      findAreasMatchingListing('Earley', 'RG6').map((a) => a.slug),
    ).toEqual(['earley'])
    expect(
      findAreasMatchingListing('Lower Earley', 'RG6').map((a) => a.slug),
    ).toEqual(['earley'])
  })

  it('matches Tilehurst by town across both its real outcodes', () => {
    expect(
      findAreasMatchingListing('Tilehurst', 'RG30').map((a) => a.slug),
    ).toEqual(['tilehurst'])
    expect(
      findAreasMatchingListing('Tilehurst', 'RG31').map((a) => a.slug),
    ).toEqual(['tilehurst'])
  })

  it('returns no match for a town/outcode outside the curated set', () => {
    expect(findAreasMatchingListing('Henley-on-Thames', 'RG9')).toEqual([])
  })
})
