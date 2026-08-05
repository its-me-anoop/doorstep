import { describe, expect, it } from 'vitest'

import { slugify } from '@/domain/slug'

// slugify backs agency slug generation (PRD §6.5 LST-1, services/listers/
// create-agency.ts) and will be reused by the M1 create-listing wizard's
// own slug field (PRD §6.5 LST-2) — kept in domain/ because it is pure
// business logic with zero framework dependency (PRD §8.5).
describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Thameside Property Partners')).toBe(
      'thameside-property-partners',
    )
  })

  it('strips punctuation, collapsing it to a single hyphen', () => {
    expect(slugify('Caversham & Kennet Estates')).toBe(
      'caversham-kennet-estates',
    )
  })

  it('strips accents to their base letters', () => {
    expect(slugify('Café Immobilier')).toBe('cafe-immobilier')
  })

  it('trims leading and trailing hyphens produced by leading/trailing punctuation', () => {
    expect(slugify('  #1 Reading Lettings!  ')).toBe('1-reading-lettings')
  })

  it('collapses runs of whitespace and punctuation into one hyphen', () => {
    expect(slugify('Acme   -  Estates')).toBe('acme-estates')
  })
})
