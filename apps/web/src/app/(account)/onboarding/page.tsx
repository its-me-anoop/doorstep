import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { RoleChoice } from '@/components/features/onboarding/role-choice'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'List a property' }

/**
 * /onboarding — PRD §6.5 LST-1's role-choice screen (M1-DESIGN-SPEC.md
 * §2.1). Gated identically to /lister at this DB-backed tier — see
 * lib/decide-gate.ts's "TWO-TIER GATING" doc comment for the proxy tier
 * half, which only checks a live session exists here too: no session ->
 * sign in; already onboarded (owner/agent/admin) -> straight to /lister,
 * since there's nothing left to choose (spec §2's opening paragraph).
 */
export default async function OnboardingPage() {
  const session = await getSessionUser()
  if (!session) {
    redirect('/sign-in?next=%2Fonboarding')
    return null
  }
  if (session.user.role !== 'user') {
    redirect('/lister')
    return null
  }

  return (
    <div className="mx-auto max-w-[640px] px-5 pt-16 pb-24 sm:px-8">
      <RoleChoice />
    </div>
  )
}
