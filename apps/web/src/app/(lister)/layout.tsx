import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { SiteHeader } from '@/components/site-header'
import { getSessionUser } from '@/lib/session'

/**
 * The real, DB-backed half of /lister's two-tier gate (PRD §8.4). See
 * lib/decide-gate.ts's "TWO-TIER GATING" doc comment for the full
 * rationale: proxy.ts's tier only checks a live session exists (never
 * the role — a stale `role: user` cookie claim can't reliably self-heal
 * mid-session), so the actual owner|agent|admin check happens here,
 * against getSessionUser()'s cryptographically verified, DB-backed role.
 * A role of `user` reaching this far means they've authenticated but
 * haven't chosen owner/agent yet — send them to the role-choice screen
 * instead of a bare 401/404.
 */
export default async function ListerLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getSessionUser()
  if (!session) {
    redirect('/sign-in?next=%2Flister')
    return null
  }
  if (session.user.role === 'user') {
    redirect('/onboarding')
    return null
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </>
  )
}
