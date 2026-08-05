import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import { WizardShell } from '@/components/features/listings/wizard/wizard-shell'
import { createServices } from '@/lib/composition'
import { listingToFormValues } from '@/lib/listing-wizard-form'
import { getSessionUser } from '@/lib/session'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { ForbiddenError } from '@/services/authz/policies'

export const metadata: Metadata = { title: 'Edit listing' }

interface EditListingPageProps {
  params: Promise<{ id: string }>
}

/**
 * `/lister/listings/{id}/edit` — the create-listing wizard's resume/edit
 * route (M1-DESIGN-SPEC.md §3, PRD §6.5 LST-2/LST-4). Server-side listing
 * load: GetListing (the same object-level authorisation the API uses,
 * services/listings/get-listing.ts's canManageListing) either returns
 * the listing or throws ForbiddenError/ListingNotFoundError — both map
 * to a plain 404 here, never a 403, so a listing this actor doesn't
 * manage doesn't even confirm it exists (manager-only 404, matching the
 * task's instruction).
 *
 * The loaded `Listing` is mapped to `ListingFormValues`
 * (lib/listing-wizard-form.ts) here, server-side, before it ever reaches
 * the client component — WizardShell's props are then already
 * JSON-safe (no `Date`s to serialise across the RSC boundary).
 */
export default async function EditListingPage({
  params,
}: EditListingPageProps) {
  const { id } = await params

  const session = await getSessionUser()
  if (!session) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/lister/listings/${id}/edit`)}`,
    )
    return null
  }

  const { listings } = createServices()

  let listing
  try {
    listing = await listings.getListing.execute(session.user, id)
  } catch (error) {
    if (
      error instanceof ListingNotFoundError ||
      error instanceof ForbiddenError
    ) {
      notFound()
      return null
    }
    throw error
  }

  return (
    <Suspense fallback={null}>
      <WizardShell
        listingId={listing.id}
        status={listing.status}
        initialValues={listingToFormValues(listing)}
      />
    </Suspense>
  )
}
