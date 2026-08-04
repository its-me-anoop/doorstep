import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Lister dashboard' }

/**
 * Gated placeholder — proxy.ts already restricts /lister to
 * owner/agent/admin roles (lib/decide-gate.ts). The real dashboard
 * (create-listing wizard, my-listings) is PRD milestone M1; this page
 * exists in M0 purely to prove the role gate works end to end.
 */
export default function ListerPage() {
  return (
    <div className="mx-auto max-w-[640px] px-5 py-16 sm:px-8">
      <p className="text-muted-foreground text-base">
        Listing management is coming in M1.
      </p>
    </div>
  )
}
