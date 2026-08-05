'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { listMyListings, ListingsApiError } from '@/lib/listings-client'
import type { Listing } from '@/ports/listing-repository'

import { ListingRow } from './listing-row'

const GENERIC_MESSAGE =
  'Something went wrong on our end — try again in a moment.'

interface ListingsListProps {
  initialListings: Listing[]
  initialNextCursor: string | null
  /** listingId -> blurhash, the server component's own first-page fetch
   * (services/images/get-cover-blurhashes.ts). Rows appended by "Load
   * more" have no entry here — see this component's own handleLoadMore
   * doc note for why. */
  initialCoverBlurhashes: Record<string, string>
}

/**
 * ListingsList — the my-listings dashboard's client half: state for the
 * server-rendered first page, cursor "Load more" pagination
 * (M1-DESIGN-SPEC.md §4), and the two mutation callbacks every row's
 * RowActions needs (a status change to reconcile in place, a delete to
 * remove the row entirely). The server component (app/(lister)/lister/
 * page.tsx) owns the actual role-scoped fetch and authorisation — this
 * component only ever renders what it's given and what the client-side
 * GET /api/v1/listings itself already scopes to "my/my agency's
 * listings" server-side.
 */
export function ListingsList({
  initialListings,
  initialNextCursor,
  initialCoverBlurhashes,
}: ListingsListProps) {
  const [listings, setListings] = useState(initialListings)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  function handleListingChange(updated: Listing) {
    setListings((prev) =>
      prev.map((listing) => (listing.id === updated.id ? updated : listing)),
    )
  }

  function handleDeleted(listingId: string) {
    setListings((prev) => prev.filter((listing) => listing.id !== listingId))
  }

  async function handleLoadMore() {
    if (!nextCursor) return
    setLoading(true)
    setLoadError(null)
    try {
      // Cover blurhashes aren't refetched for the newly-appended page —
      // services/images/get-cover-blurhashes.ts is only wired for
      // server-side use (lib/composition.ts), so a client-fetched page
      // has no route to ask for its own blurhashes. These rows fall back
      // to CoverThumbnail's flat no-photo tile until a page reload; see
      // that service's doc comment for the same reasoning applied to why
      // this milestone doesn't resolve the crisp photo either.
      const page = await listMyListings({ cursor: nextCursor })
      setListings((prev) => [...prev, ...page.data])
      setNextCursor(page.nextCursor)
    } catch (error) {
      setLoadError(
        error instanceof ListingsApiError ? error.message : GENERIC_MESSAGE,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col">
      <div>
        {listings.map((listing) => (
          <ListingRow
            key={listing.id}
            listing={listing}
            coverBlurhash={initialCoverBlurhashes[listing.id] ?? null}
            onListingChange={handleListingChange}
            onDeleted={handleDeleted}
          />
        ))}
      </div>

      {nextCursor && (
        <div className="mt-8 flex flex-col items-start gap-3">
          {loadError && (
            <p role="alert" className="text-destructive text-sm">
              {loadError}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => void handleLoadMore()}
            className="h-10 rounded-[var(--radius-md)] px-5"
          >
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
