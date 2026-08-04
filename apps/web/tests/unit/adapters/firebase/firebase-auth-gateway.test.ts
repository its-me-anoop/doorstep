import { describe, expect, it } from 'vitest'

import { toDecodedIdentity } from '@/adapters/firebase/firebase-auth-gateway'

// firebase-admin's DecodedIdToken is much bigger than this; only the
// fields toDecodedIdentity reads are relevant here.
function decodedIdToken(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'firebase-uid-1',
    aud: 'doorstep-dev',
    iss: 'https://securetoken.google.com/doorstep-dev',
    sub: 'firebase-uid-1',
    iat: 1_754_294_400,
    auth_time: 1_754_294_400,
    exp: 1_754_294_400 + 60 * 60,
    firebase: { identities: {}, sign_in_provider: 'password' },
    ...overrides,
  }
}

describe('toDecodedIdentity', () => {
  it('maps the standard claims and defaults role to user when no role claim is present', () => {
    const identity = toDecodedIdentity(
      decodedIdToken({ email: 'jamie@example.co.uk', name: 'Jamie Example' }),
    )

    expect(identity).toEqual({
      uid: 'firebase-uid-1',
      email: 'jamie@example.co.uk',
      displayName: 'Jamie Example',
      role: 'user',
      agencyId: undefined,
      authTime: new Date(1_754_294_400 * 1000),
      expiresAt: new Date((1_754_294_400 + 60 * 60) * 1000),
    })
  })

  it('maps a valid role custom claim through', () => {
    const identity = toDecodedIdentity(decodedIdToken({ role: 'agent' }))
    expect(identity.role).toBe('agent')
  })

  it('defaults role to user when the claim is present but not a known role', () => {
    const identity = toDecodedIdentity(decodedIdToken({ role: 'superuser' }))
    expect(identity.role).toBe('user')
  })

  it('maps the agencyId custom claim when present', () => {
    const identity = toDecodedIdentity(
      decodedIdToken({ role: 'agent', agencyId: 'agency-acme' }),
    )
    expect(identity.agencyId).toBe('agency-acme')
  })

  it('omits email and displayName when the token has neither', () => {
    const identity = toDecodedIdentity(decodedIdToken())
    expect(identity.email).toBeUndefined()
    expect(identity.displayName).toBeUndefined()
  })
})
