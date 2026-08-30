import { describe, expect, it } from 'vitest'

import { CURATED_AREAS, matchCuratedArea } from '@/lib/curated-areas'

describe('CURATED_AREAS typeahead', () => {
  it('includes Liverpool as an area slug, so a Liverpool query does not fall through to Reading', () => {
    expect(CURATED_AREAS.map((area) => area.slug)).toContain('liverpool')
    expect(matchCuratedArea('Liverpool')).toEqual({
      slug: 'liverpool',
      label: 'Liverpool',
    })
    expect(matchCuratedArea('liverpool')).toEqual({
      slug: 'liverpool',
      label: 'Liverpool',
    })
  })

  it('still exact-matches Reading independently of Liverpool', () => {
    expect(matchCuratedArea('Reading')?.slug).toBe('reading')
    expect(matchCuratedArea('Liverpool, England')).toBeUndefined()
  })
})
