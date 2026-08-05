import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ListingsList } from '@/components/features/listings/dashboard/listings-list'
import { Button } from '@/components/ui/button'
import { createServices } from '@/lib/composition'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Your listings' }

const addListingHref = '/lister/listings/new'

/**
 * `/lister` — the my-listings dashboard (M1-DESIGN-SPEC.md §4, PRD §6.5
 * LST-5), replacing the M0 placeholder. `mx-auto max-w-[880px]`, plain
 * flow, no card (§1.6: "list, not a card grid").
 *
 * Server component: fetches the actor's own first page via
 * ListMyListings (owner -> own listings, agent -> agency-wide — that
 * split lives in the service itself) and, for that page only, each
 * row's cover blurhash via GetCoverBlurhashes
 * (services/images/get-cover-blurhashes.ts's doc comment explains why
 * this is blurhash-only, not the crisp photo). Both are handed to
 * ListingsList (a client component) as already-JSON-safe props — a Map
 * doesn't cross the server/client boundary as cleanly as a plain object,
 * so it's converted here, the same "shape it for the client before it
 * crosses" precedent app/(lister)/lister/listings/[id]/edit/page.tsx
 * sets for `Listing` -> `ListingFormValues`.
 *
 * The lightweight status filter tabs in the full design spec's Header
 * section (All/Live/Drafts/Needs attention) are a deliberate scope cut
 * for this milestone — "All" is this page's only view, which is also the
 * spec's own default tab, so nothing here contradicts what does render.
 */
export default async function ListerPage() {
  const session = await getSessionUser()
  if (!session) {
    redirect('/sign-in?next=%2Flister')
    return null
  }

  const { listings, images } = createServices()
  const page = await listings.listMyListings.execute(session.user, {})
  const coverBlurhashes = await images.getCoverBlurhashes.execute(
    page.data.map((listing) => listing.id),
  )

  return (
    <div className="mx-auto max-w-[880px] px-5 py-16 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
          Your listings
        </h1>
        <Button
          render={<Link href={addListingHref} />}
          className="h-11 w-fit rounded-[var(--radius-md)] px-6"
        >
          Add a listing
        </Button>
      </div>

      {page.data.length === 0 ? (
        <div className="mt-16 flex max-w-[60ch] flex-col items-start gap-4">
          <h2 className="text-[length:var(--text-h3)]">
            List your first property
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Add the details, upload some photos, and we&rsquo;ll check it over —
            most listings go live within a day. It takes about ten minutes.
          </p>
          <Button
            render={<Link href={addListingHref} />}
            className="h-11 rounded-[var(--radius-md)] px-6"
          >
            Add a listing
          </Button>
        </div>
      ) : (
        <div className="mt-10">
          <ListingsList
            initialListings={page.data}
            initialNextCursor={page.nextCursor}
            initialCoverBlurhashes={Object.fromEntries(coverBlurhashes)}
          />
        </div>
      )}
    </div>
  )
}
