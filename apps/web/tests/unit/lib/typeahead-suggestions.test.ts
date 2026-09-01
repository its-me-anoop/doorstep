import { describe, expect, it } from 'vitest'

import { mergeTypeaheadSuggestions } from '@/lib/typeahead-suggestions'
import type { GeocodeSuggestion } from '@/services/geocoding/search-geocode'

const liverpoolPlace: GeocodeSuggestion = {
  kind: 'place',
  name: 'Liverpool',
  label: 'Liverpool, North West, England',
  lat: 53.4084,
  lng: -2.9916,
  outcode: null,
}

describe('mergeTypeaheadSuggestions', () => {
  it('prepends Liverpool as an Area row and keeps the geocoder Place', () => {
    const merged = mergeTypeaheadSuggestions('Liverpool', [liverpoolPlace])

    expect(merged[0]).toEqual({
      kind: 'area',
      slug: 'liverpool',
      label: 'Liverpool',
    })
    expect(merged[1]).toEqual(liverpoolPlace)
    expect(merged.filter((row) => row.kind === 'area')).toHaveLength(1)
  })

  it('still surfaces the Area row when the geocoder returns nothing', () => {
    expect(mergeTypeaheadSuggestions('liverpool', [])).toEqual([
      { kind: 'area', slug: 'liverpool', label: 'Liverpool' },
    ])
  })

  it('does not invent an Area row for an unmatched query', () => {
    expect(mergeTypeaheadSuggestions('Manchester', [liverpoolPlace])).toEqual([
      liverpoolPlace,
    ])
  })
})
