import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AgencyForm } from '@/components/features/onboarding/agency-form'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Set up your agency' }

/**
 * /onboarding/agency — the second step of PRD §6.5 LST-1's "I'm an
 * agent" path (M1-DESIGN-SPEC.md §2.2). Gated the same as its parent
 * /onboarding: no session -> sign in (round-tripping back here via
 * `?next=`); already onboarded -> straight to /lister.
 */
export default async function OnboardingAgencyPage() {
  const session = await getSessionUser()
  if (!session) {
    redirect('/sign-in?next=%2Fonboarding%2Fagency')
    return null
  }
  if (session.user.role !== 'user') {
    redirect('/lister')
    return null
  }

  return (
    <div className="px-5 pt-16 pb-24 sm:px-8">
      <AgencyForm defaultEmail={session.user.email} />
    </div>
  )
}
