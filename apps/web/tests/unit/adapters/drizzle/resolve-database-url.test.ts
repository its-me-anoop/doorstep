import { describe, expect, it } from 'vitest'

import { resolveDatabaseUrl } from '@/adapters/drizzle/client'

describe('resolveDatabaseUrl', () => {
  it('prefers DATABASE_URL when set', () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: 'postgres://a/db',
        POSTGRES_URL: 'postgres://b/db',
      }),
    ).toBe('postgres://a/db')
  })

  it('falls back to POSTGRES_URL (Vercel marketplace integrations inject this name)', () => {
    expect(resolveDatabaseUrl({ POSTGRES_URL: 'postgres://b/db' })).toBe(
      'postgres://b/db',
    )
  })

  it('throws a message naming both variables when neither is set', () => {
    expect(() => resolveDatabaseUrl({})).toThrowError(
      /DATABASE_URL.*POSTGRES_URL/,
    )
  })

  it('ignores empty-string values', () => {
    expect(() =>
      resolveDatabaseUrl({ DATABASE_URL: '', POSTGRES_URL: '' }),
    ).toThrowError()
  })
})
