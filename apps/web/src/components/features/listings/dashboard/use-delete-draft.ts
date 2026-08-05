import { useCallback, useState } from 'react'

import { deleteListing, ListingsApiError } from '@/lib/listings-client'

const GENERIC_MESSAGE =
  'Something went wrong on our end — try again in a moment.'

export type DeleteDraftPhase = 'idle' | 'confirming' | 'deleting' | 'error'

interface UseDeleteDraftOptions {
  listingId: string
  /** Called once the row's listing has actually been deleted server-side
   * — the caller removes it from the list it's rendering. */
  onDeleted: (listingId: string) => void
}

interface UseDeleteDraftResult {
  phase: DeleteDraftPhase
  errorMessage: string | null
  /** "Delete draft" clicked — swaps the action row to the inline confirm
   * (M1-DESIGN-SPEC.md §4.4), no API call yet. */
  requestConfirm: () => void
  /** "Cancel" clicked — back to the normal action row. */
  cancel: () => void
  /** "Delete" (the confirm button) clicked — the one real DELETE call. */
  confirmDelete: () => Promise<void>
}

/**
 * useDeleteDraft — the dashboard's one irreversible, non-transition
 * action (M1-DESIGN-SPEC.md §4.3/§4.4): "Delete draft" gets a
 * confirm-before-committing inline reveal, unlike every status
 * transition's true one-click fire. Deliberately its own hook rather than
 * folded into useStatusTransition: a draft row has no status-transition
 * actions at all (§4.3's table), so the two never run concurrently for
 * the same row, and keeping delete-confirm mechanics separate from
 * optimistic-transition mechanics keeps each hook single-purpose.
 */
export function useDeleteDraft({
  listingId,
  onDeleted,
}: UseDeleteDraftOptions): UseDeleteDraftResult {
  const [phase, setPhase] = useState<DeleteDraftPhase>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const requestConfirm = useCallback(() => setPhase('confirming'), [])
  const cancel = useCallback(() => setPhase('idle'), [])

  const confirmDelete = useCallback(async () => {
    setPhase('deleting')
    setErrorMessage(null)
    try {
      await deleteListing(listingId)
      onDeleted(listingId)
    } catch (error) {
      setPhase('error')
      setErrorMessage(
        error instanceof ListingsApiError ? error.message : GENERIC_MESSAGE,
      )
    }
  }, [listingId, onDeleted])

  return { phase, errorMessage, requestConfirm, cancel, confirmDelete }
}
