import type { useRouter } from 'next/navigation'

import { refreshSessionAfterUpgrade } from '@/lib/firebase-client'

/**
 * finishOnboarding — the one thing both onboarding paths (the instant
 * owner grant and agency creation) do next once the server-side role
 * upgrade has already succeeded. Mirrors
 * components/features/auth/finish-sign-in.ts's "one shared post-success
 * step" pattern, so role-choice.tsx and agency-form.tsx don't each
 * repeat it slightly differently.
 *
 * refreshSessionAfterUpgrade throws whenever there is no live Firebase
 * user to refresh a token from — per its own doc comment
 * (lib/firebase-client.ts), that is the NORMAL case here, since
 * establishServerSession already signs the client SDK out immediately
 * after every prior sign-in. Catching it is deliberate, not a swallowed
 * bug: proxy.ts's /lister gate no longer role-checks the cookie's claim
 * at all (lib/decide-gate.ts's "TWO-TIER GATING" doc comment) precisely
 * because this refresh can't reliably run mid-session — a stale claim
 * here can never lock the user out of /lister, only the DB-backed check
 * in the (lister) layout can, and that always sees the fresh role.
 */
export async function finishOnboarding(
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  try {
    await refreshSessionAfterUpgrade()
  } catch {
    // Best-effort — see doc comment above.
  }
  router.push('/lister')
  router.refresh()
}
