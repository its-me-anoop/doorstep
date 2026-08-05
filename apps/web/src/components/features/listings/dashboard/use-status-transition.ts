import { useCallback, useEffect, useRef, useState } from 'react'

import { changeListingStatus, ListingsApiError } from '@/lib/listings-client'
import type { Listing } from '@/ports/listing-repository'
import type { ListingStatusAction } from '@/services/listings/change-listing-status'

import {
  ACTION_TARGET_STATUS,
  actionPastTenseLabel,
  inverseAction,
} from './listing-status-actions'

const UNDO_WINDOW_MS = 6000
const CONFIRMATION_MS = 2000
const GENERIC_MESSAGE =
  'Something went wrong on our end — try again in a moment.'

export type TransitionPhase =
  | { type: 'idle' }
  | {
      type: 'confirmed'
      message: string
      undoAction: ListingStatusAction | null
    }
  | { type: 'error'; message: string; failedAction: ListingStatusAction }

interface UseStatusTransitionOptions {
  listing: Listing
  /** Called with the optimistically-painted listing immediately, then
   * again with the server's response once it lands (or with the
   * pre-transition listing again if the request fails — see this hook's
   * doc comment). */
  onListingChange: (listing: Listing) => void
}

interface UseStatusTransitionResult {
  phase: TransitionPhase
  /** Fires `action` immediately: optimistic paint, then the real POST in
   * parallel (M1-DESIGN-SPEC.md §4.4's implementation note — the request
   * never waits for the confirm/undo window). Clicking "Undo" is just
   * `fire(inverseAction)` — a second real request, not a client-side
   * revert (same note). */
  fire: (action: ListingStatusAction) => void
  /** Re-fires whatever action was in flight when the last request
   * failed. A no-op outside the `error` phase. */
  retry: () => void
}

/**
 * useStatusTransition — the dashboard row's one-click status action
 * mechanics (M1-DESIGN-SPEC.md §4.4): optimistic badge paint, a 6-second
 * inline "Undo" for consequential actions with a legal inverse (Hide,
 * Mark Sold STC/Let Agreed — domain/property-status-machine.ts's
 * TRANSITIONS table permits hidden/under_offer back to
 * published/under_offer), a 2-second no-undo confirmation for actions
 * with none (Mark Sold/Let — `completed`'s only legal transition is to
 * `archived`; and the reversible actions Unhide/Back on market
 * themselves), and a rollback-plus-retry on failure. One hook instance
 * per row — only one transition can be in flight for a given listing at
 * a time, since firing an action changes which actions are even valid
 * next.
 */
export function useStatusTransition({
  listing,
  onListingChange,
}: UseStatusTransitionOptions): UseStatusTransitionResult {
  const [phase, setPhase] = useState<TransitionPhase>({ type: 'idle' })
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }, [])

  useEffect(() => clearFadeTimer, [clearFadeTimer])

  const fire = useCallback(
    (action: ListingStatusAction) => {
      clearFadeTimer()

      const previous = listing
      onListingChange({ ...listing, status: ACTION_TARGET_STATUS[action] })

      const undo = inverseAction(action)
      setPhase({
        type: 'confirmed',
        message: actionPastTenseLabel(action, listing.channel),
        undoAction: undo,
      })
      fadeTimerRef.current = setTimeout(
        () => setPhase({ type: 'idle' }),
        undo ? UNDO_WINDOW_MS : CONFIRMATION_MS,
      )

      changeListingStatus(listing.id, action)
        .then((updated) => onListingChange(updated))
        .catch((error: unknown) => {
          clearFadeTimer()
          onListingChange(previous)
          setPhase({
            type: 'error',
            message:
              error instanceof ListingsApiError
                ? error.message
                : GENERIC_MESSAGE,
            failedAction: action,
          })
        })
    },
    [listing, onListingChange, clearFadeTimer],
  )

  const retry = useCallback(() => {
    if (phase.type === 'error') fire(phase.failedAction)
  }, [phase, fire])

  return { phase, fire, retry }
}
