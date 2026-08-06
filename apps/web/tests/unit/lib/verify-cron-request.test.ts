import { describe, expect, it } from 'vitest'

import { isAuthorizedCronRequest } from '@/lib/verify-cron-request'

function headers(entries: Record<string, string> = {}): Headers {
  return new Headers(entries)
}

describe('isAuthorizedCronRequest', () => {
  it('authorizes a correct CRON_SECRET bearer token, even outside production', () => {
    const result = isAuthorizedCronRequest(
      headers({ authorization: 'Bearer s3cret' }),
      { CRON_SECRET: 's3cret', NODE_ENV: 'development' },
    )
    expect(result).toBe(true)
  })

  it('rejects a wrong bearer token', () => {
    const result = isAuthorizedCronRequest(
      headers({ authorization: 'Bearer wrong' }),
      { CRON_SECRET: 's3cret' },
    )
    expect(result).toBe(false)
  })

  it('rejects a missing authorization header when CRON_SECRET is set', () => {
    const result = isAuthorizedCronRequest(headers(), {
      CRON_SECRET: 's3cret',
    })
    expect(result).toBe(false)
  })

  it('rejects every request when CRON_SECRET is not configured, even a correct-looking header', () => {
    const result = isAuthorizedCronRequest(
      headers({ authorization: 'Bearer undefined' }),
      { CRON_SECRET: undefined },
    )
    expect(result).toBe(false)
  })

  it('authorizes the x-vercel-cron header alone in production', () => {
    const result = isAuthorizedCronRequest(headers({ 'x-vercel-cron': '1' }), {
      CRON_SECRET: undefined,
      NODE_ENV: 'production',
    })
    expect(result).toBe(true)
  })

  it('rejects the x-vercel-cron header outside production (not a verified signature — spoofable by any caller)', () => {
    const result = isAuthorizedCronRequest(headers({ 'x-vercel-cron': '1' }), {
      CRON_SECRET: undefined,
      NODE_ENV: 'development',
    })
    expect(result).toBe(false)
  })

  it('rejects a request with neither a valid bearer token nor x-vercel-cron', () => {
    const result = isAuthorizedCronRequest(headers(), {
      CRON_SECRET: 's3cret',
      NODE_ENV: 'production',
    })
    expect(result).toBe(false)
  })

  it('defaults to process.env when no env argument is given', () => {
    const original = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'from-process-env'
    try {
      expect(
        isAuthorizedCronRequest(
          headers({ authorization: 'Bearer from-process-env' }),
        ),
      ).toBe(true)
    } finally {
      process.env.CRON_SECRET = original
    }
  })
})
