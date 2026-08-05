import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { greetingFor } from '@/lib/greeting'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Account' }

/**
 * M0's one authenticated page: greeting, profile summary, sign-out (the
 * sign-out control lives in the shared SiteHeader). No sidebar nav, no
 * teased "coming soon" sections — DESIGN-SPEC.md §5 is explicit that
 * ships-what-exists beats stubbing out pages that don't. Editable
 * name/phone and account deletion are in the full design spec but need
 * services this milestone doesn't build (UpdateProfile, DeleteAccount);
 * left for a later step — see this commit's fidelity notes.
 *
 * M1 addition (M1-DESIGN-SPEC.md §2.0): a lister entry point below the
 * profile panel, plain flow, no new card — role `user` gets wayfinding
 * to /onboarding; anyone already onboarded (owner/agent/admin) gets a
 * link straight to /lister instead, with no re-onboarding prompt.
 */
export default async function AccountPage() {
  const session = await getSessionUser()
  // Defence in depth: proxy.ts already redirects unauthenticated
  // requests before this ever renders (lib/decide-gate.ts's cheap,
  // unverified check). This is the real, cryptographically-verified
  // check (PRD §8.4) — it can still fail here if a session was revoked
  // or expired between the two.
  if (!session) redirect('/sign-in?next=%2Faccount')

  const { user } = session
  const greeting = greetingFor(new Date().getHours(), user.displayName)

  return (
    <div className="mx-auto max-w-[640px] px-5 pt-16 pb-24 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        {greeting}
      </h1>

      <div className="border-border bg-card mt-10 rounded-[var(--radius-lg)] border p-8">
        <dl className="flex flex-col gap-6">
          <div>
            <dt className="text-muted-foreground text-sm">Name</dt>
            <dd className="text-foreground mt-1 text-base">
              {user.displayName}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Email</dt>
            <dd className="text-foreground mt-1 text-base">{user.email}</dd>
            <p className="text-muted-foreground mt-1 text-sm">
              Contact us to change your email
            </p>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Role</dt>
            <dd className="mt-1">
              <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize">
                {user.role}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-12">
        {user.role === 'user' ? (
          <>
            <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed">
              Selling or letting a property? Doorstep&rsquo;s free while we
              build supply in Reading.
            </p>
            <Button
              render={<Link href="/onboarding" />}
              variant="secondary"
              className="mt-4 h-11 rounded-[var(--radius-md)] px-6"
            >
              Start listing a property
            </Button>
          </>
        ) : (
          <Button
            render={<Link href="/lister" />}
            variant="secondary"
            className="h-11 rounded-[var(--radius-md)] px-6"
          >
            Go to your listings
          </Button>
        )}
      </div>
    </div>
  )
}
