import { describe, expect, it } from 'vitest'

import { greetingFor } from '@/lib/greeting'

describe('greetingFor', () => {
  it('says Morning before midday', () => {
    expect(greetingFor(0, 'Sarah')).toBe('Morning, Sarah.')
    expect(greetingFor(11, 'Sarah')).toBe('Morning, Sarah.')
  })

  it('says Afternoon from midday until 6pm', () => {
    expect(greetingFor(12, 'Sarah')).toBe('Afternoon, Sarah.')
    expect(greetingFor(17, 'Sarah')).toBe('Afternoon, Sarah.')
  })

  it('says Evening from 6pm onward', () => {
    expect(greetingFor(18, 'Sarah')).toBe('Evening, Sarah.')
    expect(greetingFor(23, 'Sarah')).toBe('Evening, Sarah.')
  })

  it('uses only the first name when given a full name', () => {
    expect(greetingFor(9, 'Sarah Cole')).toBe('Morning, Sarah.')
  })

  it('falls back to a plain greeting when the name is missing or blank', () => {
    expect(greetingFor(9, null)).toBe('Hello.')
    expect(greetingFor(9, '')).toBe('Hello.')
    expect(greetingFor(9, '   ')).toBe('Hello.')
  })
})
