import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin' }

/**
 * Gated placeholder — proxy.ts already restricts /admin to the admin
 * role (lib/decide-gate.ts). The real moderation queue, user/agency
 * management, analytics and audit log are PRD milestone M5; this page
 * exists in M0 purely to prove the role gate works end to end.
 */
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-[640px] px-5 py-16 sm:px-8">
      <p className="text-muted-foreground text-base">
        Admin tools are coming in M5.
      </p>
    </div>
  )
}
