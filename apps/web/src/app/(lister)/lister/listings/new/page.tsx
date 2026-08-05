import type { Metadata } from 'next'

import { NewListingRedirect } from '@/components/features/listings/new-listing-redirect'

export const metadata: Metadata = { title: 'New listing' }

/**
 * `/lister/listings/new` — PRD §6.5 LST-2's create-listing wizard entry
 * point (M1-DESIGN-SPEC.md §3). Gated by app/(lister)/layout.tsx
 * (owner/agent/admin only); the actual "create a draft, then route into
 * the wizard" behaviour lives in NewListingRedirect, a client component
 * (it needs a session-cookie-authenticated POST and a client-side
 * redirect — see that component's own doc comment for why the draft's
 * initial channel/propertyType are placeholders, not a real choice).
 */
export default function NewListingPage() {
  return <NewListingRedirect />
}
