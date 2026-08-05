import { describe, expect, it } from 'vitest'

import { computeDisplayAddress, extractStreetName } from '@/lib/format-address'

// M1-DESIGN-SPEC.md §3.2 field 3: the "street name and area only
// (recommended)" preview strips the house number/name off addressLine1
// ("House number and street name") — postcodes.io never gives us this
// split, so it's a client-side text transform.
describe('extractStreetName', () => {
  it('strips a plain house number', () => {
    expect(extractStreetName('12 Oxford Road')).toBe('Oxford Road')
  })

  it('strips a house number with a letter suffix', () => {
    expect(extractStreetName('12a Oxford Road')).toBe('Oxford Road')
  })

  it('strips a hyphenated number range', () => {
    expect(extractStreetName('12-14 Oxford Road')).toBe('Oxford Road')
  })

  it('leaves a named (non-numbered) address untouched', () => {
    expect(extractStreetName('The Cottage, Mill Lane')).toBe(
      'The Cottage, Mill Lane',
    )
  })

  it('leaves a flat-prefixed address untouched (no leading number to strip)', () => {
    expect(extractStreetName('Flat 2, Oxford Road')).toBe('Flat 2, Oxford Road')
  })

  it('handles an empty string', () => {
    expect(extractStreetName('')).toBe('')
  })
})

describe('computeDisplayAddress', () => {
  const base = {
    addressLine1: '12 Oxford Road',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
  }

  it('street choice: "Oxford Road, Reading, RG30" — the spec\'s own worked example', () => {
    expect(computeDisplayAddress('street', base)).toBe(
      'Oxford Road, Reading, RG30',
    )
  })

  it('full choice: house number, town and the full postcode', () => {
    expect(computeDisplayAddress('full', base)).toBe(
      '12 Oxford Road, Reading, RG30 1AA',
    )
  })

  it('drops empty segments rather than leaving stray ", ,"', () => {
    expect(
      computeDisplayAddress('street', { ...base, town: '', outcode: '' }),
    ).toBe('Oxford Road')
  })

  it('returns an empty string when addressLine1 itself is empty', () => {
    expect(computeDisplayAddress('street', { ...base, addressLine1: '' })).toBe(
      '',
    )
    expect(computeDisplayAddress('full', { ...base, addressLine1: '' })).toBe(
      '',
    )
  })
})
