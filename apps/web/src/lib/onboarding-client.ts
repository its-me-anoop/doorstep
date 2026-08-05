/**
 * lib/onboarding-client.ts — the browser-side calls behind lister
 * onboarding (PRD §6.5 LST-1, M1-DESIGN-SPEC.md §2): POST the two
 * onboarding routes and turn their `{ error: { code, message } }`
 * envelope (lib/api-error.ts) into the plain, specific copy the
 * onboarding UI shows. Centralised here for the same reason
 * lib/auth-error-messages.ts's mapFirebaseAuthError is centralised: one
 * place decides the tone, rather than each form inlining its own
 * `switch` on an error code.
 *
 * Deliberately calls `fetch` directly rather than going through
 * lib/firebase-client.ts — these routes authenticate off the existing
 * session cookie (sent automatically, same-origin), there is no Firebase
 * ID token involved on this side of onboarding at all.
 */

import type { CreateAgencyInput } from './validation/agency'

export class OnboardingApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'OnboardingApiError'
  }
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  unauthenticated: 'Your session has expired — sign in again to continue.',
  account_suspended:
    "This account can't do that right now — contact us if you think that's wrong.",
  forbidden: "You've already completed this step.",
  invalid_request: 'Check the highlighted fields and try again.',
}

const GENERIC_MESSAGE =
  'Something went wrong on our end — try again in a moment.'

function friendlyMessageFor(code: string): string {
  return FRIENDLY_MESSAGES[code] ?? GENERIC_MESSAGE
}

async function postOnboarding(
  path: 'owner' | 'agency',
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`/api/v1/onboarding/${path}`, {
    method: 'POST',
    ...(body !== undefined
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })

  const json: { data?: unknown; error?: { code?: string } } | null =
    await response.json().catch(() => null)

  if (!response.ok) {
    const code = json?.error?.code ?? 'internal_error'
    throw new OnboardingApiError(code, friendlyMessageFor(code))
  }

  return json?.data
}

/** PRD §6.5 LST-1's "I'm a private owner" path — instant role grant. */
export async function becomeOwner(): Promise<void> {
  await postOnboarding('owner')
}

/** PRD §6.5 LST-1's "I'm an agent" path — creates the agency, grants `agent`. */
export async function createAgency(input: CreateAgencyInput): Promise<void> {
  await postOnboarding('agency', input)
}
