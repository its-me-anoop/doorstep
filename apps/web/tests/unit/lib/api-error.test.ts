import { describe, expect, it } from 'vitest'

import { apiError } from '@/lib/api-error'

describe('apiError', () => {
  it('builds the consistent { error: { code, message } } envelope with the given status', async () => {
    const response = apiError(400, 'invalid_request', 'idToken is required')

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'invalid_request', message: 'idToken is required' },
    })
  })

  it('sets a distinct status for a different call', async () => {
    const response = apiError(403, 'account_suspended', 'Account is suspended')
    expect(response.status).toBe(403)
  })
})
