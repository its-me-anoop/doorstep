/**
 * mapFirebaseAuthError — turns a thrown Firebase Auth error into the
 * plain, human copy the sign-in/sign-up forms show (DESIGN-SPEC.md §4
 * "Error and validation copy tone"). Centralised here rather than
 * inlined in each form so the tone stays consistent and the raw
 * Firebase error string — which the spec explicitly says must never
 * reach the user — has exactly one place it could leak from.
 *
 * `console.error`s the original error for now; PRD §7.7 calls for this
 * to go to Sentry once that's wired up (not part of this milestone).
 */

export type AuthErrorCode =
  'email-already-in-use' | 'credential-mismatch' | 'weak-password' | 'generic'

export interface AuthErrorPresentation {
  code: AuthErrorCode
  message: string
  /**
   * True when the form should show nothing at all — the user closing an
   * OAuth popup is an intentional cancellation, not a failure.
   */
  silent: boolean
}

const MESSAGES: Record<Exclude<AuthErrorCode, never>, string> = {
  'email-already-in-use':
    "You've already got an account with that email — sign in instead.",
  'credential-mismatch':
    "That email and password don't match. Try again, or reset your password.",
  'weak-password': 'Your password needs at least 8 characters.',
  generic: 'Something went wrong on our end — try again in a moment.',
}

const CODE_MAP: Record<string, AuthErrorCode> = {
  'auth/email-already-in-use': 'email-already-in-use',
  'auth/invalid-credential': 'credential-mismatch',
  'auth/wrong-password': 'credential-mismatch',
  'auth/user-not-found': 'credential-mismatch',
  'auth/weak-password': 'weak-password',
}

const SILENT_CODES = new Set(['auth/popup-closed-by-user'])

export function mapFirebaseAuthError(error: unknown): AuthErrorPresentation {
  const firebaseCode = getFirebaseErrorCode(error)

  if (firebaseCode && SILENT_CODES.has(firebaseCode)) {
    return { code: 'generic', message: '', silent: true }
  }

  const code = (firebaseCode && CODE_MAP[firebaseCode]) || 'generic'

  if (code === 'generic') {
    // Stand-in for Sentry (PRD §7.7), not yet wired up in this milestone.
    console.error('Unhandled Firebase auth error', error)
  }

  return { code, message: MESSAGES[code], silent: false }
}

function getFirebaseErrorCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code
  }
  return null
}
