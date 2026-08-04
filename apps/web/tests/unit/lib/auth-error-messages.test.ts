import { describe, expect, it } from 'vitest'

import { mapFirebaseAuthError } from '@/lib/auth-error-messages'

function firebaseError(code: string) {
  return { code, message: `Firebase: Error (${code}).`, name: 'FirebaseError' }
}

describe('mapFirebaseAuthError', () => {
  it('maps auth/email-already-in-use to the sign-in-instead copy, not silent', () => {
    const result = mapFirebaseAuthError(
      firebaseError('auth/email-already-in-use'),
    )
    expect(result.code).toBe('email-already-in-use')
    expect(result.silent).toBe(false)
    expect(result.message).toBe(
      "You've already got an account with that email — sign in instead.",
    )
  })

  it.each([
    'auth/invalid-credential',
    'auth/wrong-password',
    'auth/user-not-found',
  ])('maps %s to the non-enumerating credential-mismatch copy', (code) => {
    const result = mapFirebaseAuthError(firebaseError(code))
    expect(result.code).toBe('credential-mismatch')
    expect(result.silent).toBe(false)
    expect(result.message).toBe(
      "That email and password don't match. Try again, or reset your password.",
    )
  })

  it('never confirms or denies that the email exists in the credential-mismatch copy', () => {
    const result = mapFirebaseAuthError(firebaseError('auth/wrong-password'))
    expect(result.message.toLowerCase()).not.toMatch(
      /no account|doesn't exist|not found|already have/,
    )
  })

  it('maps auth/weak-password to the 8-character copy', () => {
    const result = mapFirebaseAuthError(firebaseError('auth/weak-password'))
    expect(result.code).toBe('weak-password')
    expect(result.message).toBe('Your password needs at least 8 characters.')
  })

  it('maps auth/popup-closed-by-user to a silent result with no message shown', () => {
    const result = mapFirebaseAuthError(
      firebaseError('auth/popup-closed-by-user'),
    )
    expect(result.silent).toBe(true)
  })

  it('maps an unrecognised Firebase code to the generic fallback copy', () => {
    const result = mapFirebaseAuthError(
      firebaseError('auth/network-request-failed'),
    )
    expect(result.code).toBe('generic')
    expect(result.silent).toBe(false)
    expect(result.message).toBe(
      'Something went wrong on our end — try again in a moment.',
    )
  })

  it('never leaks the raw Firebase error string into the generic fallback', () => {
    const result = mapFirebaseAuthError(firebaseError('auth/internal-error'))
    expect(result.message).not.toContain('Firebase')
    expect(result.message).not.toContain('auth/internal-error')
  })

  it('falls back to the generic copy for a non-FirebaseError throwable', () => {
    const result = mapFirebaseAuthError(new Error('network down'))
    expect(result.code).toBe('generic')
    expect(result.silent).toBe(false)
  })

  it('falls back to the generic copy for a thrown non-object value', () => {
    const result = mapFirebaseAuthError('nope')
    expect(result.code).toBe('generic')
  })
})
