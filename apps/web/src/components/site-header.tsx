import Link from 'next/link'

import { SignOutButton } from '@/components/sign-out-button'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'
import { getSessionUser } from '@/lib/session'

/**
 * Flush-left wordmark, flush-right nav — never centred, never a hamburger
 * at any width (DESIGN-SPEC.md §3). Session-aware: reading
 * getSessionUser() here (rather than passing it down from each page)
 * keeps every page that renders this header signed-in-aware for free,
 * at the cost of opting the (public) route group out of static
 * rendering — an accepted trade-off for M0 (see the commit's fidelity
 * notes; ISR on the marketing pages is a later refinement).
 */
export async function SiteHeader() {
  const session = await getSessionUser()

  return (
    <header className="border-border bg-background border-b">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 sm:px-8 lg:h-[72px] lg:px-16">
        <Wordmark />
        <nav className="flex items-center gap-6">
          {session ? (
            <>
              <Link
                href="/account"
                className="text-foreground hover:text-primary text-sm font-medium"
              >
                Account
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-foreground hover:text-primary text-sm font-medium"
              >
                Sign in
              </Link>
              <Button
                render={<Link href="/sign-up" />}
                size="sm"
                className="h-11 rounded-[var(--radius-md)] px-4"
              >
                Get early access
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
