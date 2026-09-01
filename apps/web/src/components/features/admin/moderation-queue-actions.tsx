'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Listing } from '@/ports/listing-repository'

interface ModerationQueueActionsProps {
  listing: Listing
}

export function ModerationQueueActions({
  listing,
}: ModerationQueueActionsProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  async function decide(decision: 'approve' | 'reject') {
    setPending(true)
    try {
      const response = await fetch(
        `/api/v1/admin/listings/${listing.id}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            rejectionReason: decision === 'reject' ? reason : undefined,
          }),
        },
      )
      if (response.ok) {
        setRejecting(false)
        setReason('')
        router.refresh()
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {rejecting ? (
        <>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Rejection reason"
            className="border-input min-h-20 rounded-lg border bg-transparent px-2.5 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={() => decide('reject')}
              className="h-9 rounded-[var(--radius-md)] px-4"
            >
              Confirm reject
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setRejecting(false)}
              className="h-9 rounded-[var(--radius-md)] px-4"
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() => decide('approve')}
            className="h-9 rounded-[var(--radius-md)] px-4"
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="h-9 rounded-[var(--radius-md)] px-4"
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}
