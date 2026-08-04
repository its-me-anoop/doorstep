import type { useRouter } from 'next/navigation'
import type { UserCredential } from 'firebase/auth'

import { establishServerSession } from '@/lib/firebase-client'

/**
 * The one thing every successful auth path — email/password sign-in,
 * email/password sign-up, Google, Apple — does next: exchange the fresh
 * Firebase credential for a server session cookie, then move on.
 * Centralised so sign-in-form, sign-up-form and oauth-buttons don't each
 * repeat it slightly differently.
 */
export async function finishSignIn(
  credential: UserCredential,
  router: ReturnType<typeof useRouter>,
  nextPath: string,
): Promise<void> {
  await establishServerSession(credential)
  router.push(nextPath)
  router.refresh()
}
