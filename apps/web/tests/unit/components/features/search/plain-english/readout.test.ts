import { describe, expect, it } from 'vitest'

import { buildNlSearchReadout } from '@/components/features/search/plain-english/readout'
import { parseNaturalLanguageSearch } from '@/lib/nl-search/parse'

// Plain-English search — the "show what we understood before applying
// it" read-out: chips per facet, dismissals, and the on-device model's
// suggestions marked as such.

const NOW = new Date('2026-09-14T12:00:00Z')

function readout(
  text: string,
  options: Partial<Parameters<typeof buildNlSearchReadout>[0]> = {},
) {
  return buildNlSearchReadout({
    parse: parseNaturalLanguageSearch(text, { now: NOW }),
    fallbackChannel: 'sale',
    ...options,
  })
}

describe('buildNlSearchReadout', () => {
  it('produces one chip per facet, labelled like the results page chips', () => {
    const result = readout(
      'unfurnished 2-3 bed house to rent in Reading between £1,200 and £1,800 pcm from October, cheapest first, on a map',
    )
    expect(result.chips.map((chip) => [chip.facet, chip.label])).toEqual([
      ['channel', 'To rent'],
      ['place', 'Reading'],
      ['beds', '2 beds–3 beds'],
      ['price', '£1,200 pcm–£1,800 pcm'],
      ['type', 'House'],
      ['furnished', 'Unfurnished'],
      ['availableFrom', 'Available by 1 October 2026'],
      ['sort', 'Cheapest first'],
      ['view', 'Map view'],
    ])
    expect(result.channel).toBe('rent')
    expect(result.chips.every((chip) => chip.source === 'parsed')).toBe(true)
  })

  it.each([
    ['2 bed', '2+ beds'],
    ['exactly 1 bedroom', '1 bed'],
    ['studio', 'Studio'],
    ['up to 3 beds', 'Up to 3 beds'],
    ['6 bed', '6+ beds'],
  ])('labels beds for "%s" as %s', (text, label) => {
    expect(
      readout(text).chips.find((chip) => chip.facet === 'beds')?.label,
    ).toBe(label)
  })

  it.each([
    ['under £350k', 'Up to £350,000'],
    ['from £250k', 'From £250,000'],
    ['around 300k', '£270,000–£330,000'],
  ])('labels sale prices for "%s" as %s', (text, label) => {
    expect(
      readout(text).chips.find((chip) => chip.facet === 'price')?.label,
    ).toBe(label)
  })

  it('labels a rent price in pcm when the search is on the rent channel', () => {
    expect(
      readout('under 1200', { fallbackChannel: 'rent' }).chips.find(
        (chip) => chip.facet === 'price',
      )?.label,
    ).toBe('Up to £1,200 pcm')
  })

  it('labels types: a single type by its wizard label, "house" as House, 3+ as a count', () => {
    expect(readout('flat').chips[0].label).toBe('Flat or apartment')
    expect(readout('house').chips[0].label).toBe('House')
    expect(readout('house or flat').chips[0].label).toBe(
      'House or Flat or apartment',
    )
    expect(readout('flat, bungalow or maisonette').chips[0].label).toBe(
      '3 property types',
    )
  })

  it('falls back to the surrounding channel when the sentence has no cue', () => {
    expect(readout('2 bed flat').channel).toBe('sale')
    expect(readout('2 bed flat', { fallbackChannel: 'rent' }).channel).toBe(
      'rent',
    )
    expect(readout('2 bed flat').chips.map((chip) => chip.facet)).not.toContain(
      'channel',
    )
  })

  it('returns exactly the filters the kept chips describe', () => {
    expect(readout('2 bed flat in Reading under £350k').filters).toEqual({
      minBeds: 2,
      maxPrice: 350_000,
      type: ['flat'],
    })
  })

  it('drops a dismissed facet from the filters but keeps its chip for display', () => {
    const result = readout('2 bed flat under £350k', {
      dismissed: new Set(['price']),
    })
    expect(result.filters).toEqual({ minBeds: 2, type: ['flat'] })
    expect(result.chips.map((chip) => chip.facet)).toContain('price')
  })

  it('dismissing the channel chip reverts to the surrounding channel', () => {
    expect(
      readout('flat to rent', { dismissed: new Set(['channel']) }).channel,
    ).toBe('sale')
  })

  it('adds a marked "suggested" type chip from the model only when no rule found a type', () => {
    const withHint = readout('something in Reading with a converted barn', {
      hints: [
        {
          kind: 'type',
          types: ['detached'],
          phrase: 'converted barn',
          score: 0.9,
        },
      ],
    })
    expect(withHint.chips).toContainEqual({
      facet: 'type',
      label: 'Detached house',
      source: 'suggested',
      because: 'converted barn',
    })
    expect(withHint.filters.type).toEqual(['detached'])

    const ruleWins = readout('flat in Reading converted barn', {
      hints: [
        {
          kind: 'type',
          types: ['detached'],
          phrase: 'converted barn',
          score: 0.9,
        },
      ],
    })
    expect(ruleWins.filters.type).toEqual(['flat'])
    expect(ruleWins.chips.filter((chip) => chip.facet === 'type')).toHaveLength(
      1,
    )
  })

  it('lists unsupported wishes, rule-based first then suggested, without duplicates', () => {
    const result = readout('flat with parking and room for the car', {
      hints: [
        {
          kind: 'unsupported',
          label: 'Parking',
          phrase: 'room for the car',
          score: 0.6,
        },
        {
          kind: 'unsupported',
          label: 'Quiet area',
          phrase: 'room for the car',
          score: 0.6,
        },
      ],
    })
    expect(result.unsupported).toEqual([
      { label: 'Parking', source: 'parsed' },
      { label: 'Quiet area', source: 'suggested' },
    ])
  })
})
