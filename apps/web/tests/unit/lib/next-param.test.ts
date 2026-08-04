import { describe, expect, it } from 'vitest'

import { sanitizeNextPath } from '@/lib/next-param'

describe('sanitizeNextPath', () => {
  it('returns the candidate when it is a plain relative path', () => {
    expect(sanitizeNextPath('/account')).toBe('/account')
    expect(sanitizeNextPath('/lister/listings/new')).toBe(
      '/lister/listings/new',
    )
  })

  it('keeps query strings and hashes on an otherwise-safe relative path', () => {
    expect(sanitizeNextPath('/for-sale/reading?beds=3')).toBe(
      '/for-sale/reading?beds=3',
    )
  })

  it('falls back for null, undefined or empty input', () => {
    expect(sanitizeNextPath(null)).toBe('/account')
    expect(sanitizeNextPath(undefined)).toBe('/account')
    expect(sanitizeNextPath('')).toBe('/account')
  })

  it('falls back for a custom fallback path', () => {
    expect(sanitizeNextPath(null, '/lister')).toBe('/lister')
  })

  it('rejects a path that does not start with a single slash', () => {
    expect(sanitizeNextPath('account')).toBe('/account')
    expect(sanitizeNextPath('https://evil.example/phish')).toBe('/account')
  })

  it('rejects protocol-relative paths (open-redirect via //host)', () => {
    expect(sanitizeNextPath('//evil.example')).toBe('/account')
    expect(sanitizeNextPath('///evil.example')).toBe('/account')
  })

  it('rejects backslash tricks browsers normalise to protocol-relative URLs', () => {
    expect(sanitizeNextPath('/\\evil.example')).toBe('/account')
    expect(sanitizeNextPath('\\/evil.example')).toBe('/account')
  })

  it('rejects an embedded scheme that some parsers still treat as absolute', () => {
    expect(sanitizeNextPath('/\tjavascript:alert(1)')).toBe('/account')
  })
})
