import { afterEach, describe, expect, it, vi } from 'vitest'

import { isAuthorizedCronRequest } from '@/lib/verify-cron-request'

function headers(entries: Record<string, string> = {}): Headers {
  return new Headers(entries)
}

describe('isAuthorizedCronRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('rejects the x-vercel-cron header alone, even in production — it is an informational marker any caller can spoof, never a valid auth path on its own', () => {
    const result = isAuthorizedCronRequest(headers({ 'x-vercel-cron': '1' }), {
      CRON_SECRET: 's3cret',
      NODE_ENV: 'production',
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

  it('loudly logs a misconfiguration error when CRON_SECRET is unset in production — every request is rejected until it is fixed', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const result = isAuthorizedCronRequest(headers({ 'x-vercel-cron': '1' }), {
      CRON_SECRET: undefined,
      NODE_ENV: 'production',
    })

    expect(result).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('CRON_SECRET'),
    )
  })

  it('does not log the misconfiguration error outside production', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    isAuthorizedCronRequest(headers(), {
      CRON_SECRET: undefined,
      NODE_ENV: 'development',
    })

    expect(consoleError).not.toHaveBeenCalled()
  })

  it('does not log the misconfiguration error when CRON_SECRET is set', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    isAuthorizedCronRequest(headers(), {
      CRON_SECRET: 's3cret',
      NODE_ENV: 'production',
    })

    expect(consoleError).not.toHaveBeenCalled()
  })
})
