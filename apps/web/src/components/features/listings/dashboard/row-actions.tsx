'use client'

import Link from 'next/link'

import type { Listing } from '@/ports/listing-repository'

import { actionButtonLabel } from './listing-status-actions'
import { useDeleteDraft } from './use-delete-draft'
import { useStatusTransition } from './use-status-transition'

interface RowActionsProps {
  listing: Listing
  onListingChange: (listing: Listing) => void
  onDeleted: (listingId: string) => void
}

const editHref = (id: string) => `/lister/listings/${id}/edit`

function formatReviewSince(statusChangedAt: Date | null): string {
  if (!statusChangedAt) return 'recently'
  return new Date(statusChangedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** 44×44px hit area on a small text control, visual size unchanged — the
 * M0 checkbox pattern §5's accessibility checklist calls for on Undo/
 * Retry specifically. */
const undoRetryClassName =
  'text-primary inline-flex min-h-11 items-center text-sm font-medium'

/**
 * RowActions — the my-listings dashboard row's per-status action matrix
 * (M1-DESIGN-SPEC.md §4.3), plus the optimistic-transition/undo strip and
 * the delete-draft inline confirm that replace it in place (§4.4). One
 * status's worth of actions renders at a time; `useStatusTransition` and
 * `useDeleteDraft` are called unconditionally (rules of hooks) but only
 * one is ever visibly active for a given row, since a draft has no
 * status-transition actions and every other status has no delete action.
 */
export function RowActions({
  listing,
  onListingChange,
  onDeleted,
}: RowActionsProps) {
  const { phase, fire, retry } = useStatusTransition({
    listing,
    onListingChange,
  })
  const deleteDraft = useDeleteDraft({ listingId: listing.id, onDeleted })

  if (phase.type === 'confirmed') {
    return (
      <div
        aria-live="polite"
        className="opacity-transition flex items-center gap-2 text-sm"
      >
        <span className={phase.undoAction ? 'text-foreground' : 'text-success'}>
          {phase.message}
        </span>
        {phase.undoAction && (
          <button
            type="button"
            onClick={() => fire(phase.undoAction!)}
            className={undoRetryClassName}
          >
            Undo
          </button>
        )}
      </div>
    )
  }

  if (phase.type === 'error') {
    return (
      <div aria-live="polite" className="flex items-center gap-2 text-sm">
        <span className="text-destructive">
          Couldn&rsquo;t update — try again.
        </span>
        <button type="button" onClick={retry} className={undoRetryClassName}>
          Retry
        </button>
      </div>
    )
  }

  if (listing.status === 'draft') {
    if (
      deleteDraft.phase === 'confirming' ||
      deleteDraft.phase === 'deleting'
    ) {
      return (
        <div
          aria-live="polite"
          className="opacity-transition flex items-center gap-3 text-sm"
        >
          <span>Delete this draft? This can&rsquo;t be undone.</span>
          <button
            type="button"
            aria-disabled={deleteDraft.phase === 'deleting'}
            onClick={() => void deleteDraft.confirmDelete()}
            className="text-destructive font-medium"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={deleteDraft.cancel}
            className="text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      )
    }
    if (deleteDraft.phase === 'error') {
      return (
        <div aria-live="polite" className="flex items-center gap-2 text-sm">
          <span className="text-destructive">{deleteDraft.errorMessage}</span>
          <button
            type="button"
            onClick={() => void deleteDraft.confirmDelete()}
            className={undoRetryClassName}
          >
            Retry
          </button>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={editHref(listing.id)}
          className="text-foreground font-medium"
        >
          Continue editing
        </Link>
        <button
          type="button"
          onClick={deleteDraft.requestConfirm}
          className="text-destructive"
        >
          Delete draft
        </button>
      </div>
    )
  }

  if (listing.status === 'pending_review') {
    return (
      <p className="text-muted-foreground text-sm">
        {`In review since ${formatReviewSince(listing.statusChangedAt)} — we usually decide within a day.`}
      </p>
    )
  }

  if (listing.status === 'rejected') {
    return (
      <Link
        href={editHref(listing.id)}
        className="text-foreground text-sm font-medium"
      >
        Edit and resubmit
      </Link>
    )
  }

  if (listing.status === 'published') {
    const markAction = listing.channel === 'rent' ? 'let_agreed' : 'sold_stc'
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => fire(markAction)}
          className="text-foreground font-medium"
        >
          {actionButtonLabel(markAction, listing.channel)}
        </button>
        <button
          type="button"
          onClick={() => fire('hide')}
          className="text-muted-foreground"
        >
          Hide
        </button>
        <Link href={editHref(listing.id)} className="text-primary">
          Edit
        </Link>
      </div>
    )
  }

  if (listing.status === 'under_offer') {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => fire('complete')}
          className="text-foreground font-medium"
        >
          {actionButtonLabel('complete', listing.channel)}
        </button>
        <button
          type="button"
          onClick={() => fire('back_on_market')}
          className="text-muted-foreground"
        >
          Back on market
        </button>
        <Link href={editHref(listing.id)} className="text-primary">
          Edit
        </Link>
      </div>
    )
  }

  if (listing.status === 'completed') {
    return (
      <p className="text-muted-foreground text-sm">
        Archived automatically after 90 days.
      </p>
    )
  }

  if (listing.status === 'hidden') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => fire('unhide')}
            className="text-foreground font-medium"
          >
            Unhide
          </button>
          <Link href={editHref(listing.id)} className="text-primary">
            Edit
          </Link>
        </div>
        <p className="text-muted-foreground text-xs">
          Hidden listings are removed automatically after 6 months if not
          unhidden.
        </p>
      </div>
    )
  }

  // archived — terminal, no lister action exists (M1-DESIGN-SPEC.md §1.3:
  // archived is system-only, never reached through a lister action, but
  // handled defensively rather than assuming a row can never render one).
  return null
}
