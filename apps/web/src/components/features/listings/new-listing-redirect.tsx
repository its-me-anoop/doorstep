'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { createDraftListing, ListingsApiError } from '@/lib/listings-client'

const GENERIC_ERROR = 'Something went wrong on our end — try again in a moment.'

/**
 * `/lister/listings/new` (M1-DESIGN-SPEC.md §3): the wizard has no
 * "create" step of its own — visiting this route immediately creates a
 * draft and routes straight into the wizard shell at
 * `/lister/listings/{id}/edit`. `channel: 'sale'`/`propertyType: 'other'`
 * are placeholder values, not a real choice on the user's behalf: they
 * exist only because draftListingSchema requires both fields even on
 * the very first save (see that schema's own doc comment) — the
 * wizard's own step 1 is where the user actually answers this, and
 * autosave overwrites these the moment they do.
 */
export function NewListingRedirect() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function createAndRedirect() {
    try {
      const listing = await createDraftListing({
        channel: 'sale',
        propertyType: 'other',
      })
      router.replace(`/lister/listings/${listing.id}/edit`)
    } catch (err) {
      setError(err instanceof ListingsApiError ? err.message : GENERIC_ERROR)
    }
  }

  useEffect(() => {
    // react-hooks/set-state-in-effect flags this because
    // createAndRedirect's catch branch can call setError. That's the
    // right rule for effects that derive state from props (the usual
    // cascading-render footgun) — it doesn't fit this effect, which has
    // no such derivation: visiting this route *is* the user action that
    // starts a one-shot "create a draft, then navigate" request, exactly
    // like a click handler would, just triggered by navigation instead
    // of a click. There is no external system to subscribe to and
    // nothing to synchronize on a later render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void createAndRedirect()
    // Run once on mount only — retries are the user clicking "Try
    // again" below, which calls handleRetry directly, not another
    // effect run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleRetry() {
    setError(null)
    void createAndRedirect()
  }

  return (
    <div className="mx-auto max-w-[640px] px-5 pt-16 pb-24 sm:px-8">
      {error ? (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
          <Button
            type="button"
            onClick={handleRetry}
            className="h-11 w-fit rounded-[var(--radius-md)] px-6"
          >
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-base">
          Setting up your listing…
        </p>
      )}
    </div>
  )
}
