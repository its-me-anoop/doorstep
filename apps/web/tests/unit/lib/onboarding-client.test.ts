import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  becomeOwner,
  createAgency,
  OnboardingApiError,
} from '@/lib/onboarding-client'
import type { CreateAgencyInput } from '@/lib/validation/agency'

const VALID_AGENCY: CreateAgencyInput = {
  name: 'Thameside Property Partners',
  phone: '0118 950 1147',
  email: 'hello@thamesidepropertypartners.co.uk',
  website: 'https://www.thamesidepropertypartners.co.uk',
  address: '12 Kings Road, Reading, RG1 3AA',
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('lib/onboarding-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('becomeOwner', () => {
    it('POSTs to /api/v1/onboarding/owner with no body', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, { data: { user: {} } }))
      vi.stubGlobal('fetch', fetchMock)

      await becomeOwner()

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/onboarding/owner',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws an OnboardingApiError carrying friendly copy when the API returns an error envelope', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(401, {
            error: { code: 'unauthenticated', message: 'Sign in to continue.' },
          }),
        ),
      )

      await expect(becomeOwner()).rejects.toMatchObject({
        code: 'unauthenticated',
      })
    })

    it('maps an unrecognised error code to the generic friendly message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(500, {
            error: { code: 'internal_error', message: 'boom' },
          }),
        ),
      )

      const error = await becomeOwner().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(OnboardingApiError)
      expect((error as OnboardingApiError).message).toMatch(
        /something went wrong/i,
      )
    })
  })

  describe('createAgency', () => {
    it('POSTs the agency input as JSON', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { data: { user: {}, agency: {} } }),
        )
      vi.stubGlobal('fetch', fetchMock)

      await createAgency(VALID_AGENCY)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/onboarding/agency',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(VALID_AGENCY),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      )
    })

    it('maps a 400 invalid_request into friendly copy', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(400, {
            error: {
              code: 'invalid_request',
              message: 'Enter a contact phone number.',
            },
          }),
        ),
      )

      const error = await createAgency(VALID_AGENCY).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(OnboardingApiError)
      expect((error as OnboardingApiError).code).toBe('invalid_request')
    })
  })
})
