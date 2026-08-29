'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { EnquiryStatus } from '@/domain/enums'
import type { Enquiry } from '@/ports/enquiry-repository'

interface EnquiryInboxProps {
  enquiries: Enquiry[]
}

const STATUS_OPTIONS: EnquiryStatus[] = ['new', 'contacted', 'closed']

export function EnquiryInbox({ enquiries }: EnquiryInboxProps) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function updateStatus(enquiryId: string, status: EnquiryStatus) {
    setPendingId(enquiryId)
    try {
      await fetch(`/api/v1/enquiries/${enquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  if (enquiries.length === 0) {
    return (
      <p className="text-muted-foreground mt-10 text-base leading-relaxed">
        No enquiries yet. When someone messages you about a listing, it will
        appear here.
      </p>
    )
  }

  return (
    <ul className="mt-10 flex flex-col gap-4">
      {enquiries.map((enquiry) => (
        <li
          key={enquiry.id}
          className="border-border bg-card rounded-[var(--radius-md)] border p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-foreground text-base font-medium">
                {enquiry.name}
              </p>
              <p className="text-muted-foreground text-sm">
                <a
                  href={`mailto:${enquiry.email}`}
                  className="hover:text-foreground"
                >
                  {enquiry.email}
                </a>
                {enquiry.phone && ` · ${enquiry.phone}`}
              </p>
            </div>
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium capitalize">
              {enquiry.status}
            </span>
          </div>
          <p className="text-foreground mt-4 text-sm leading-relaxed whitespace-pre-wrap">
            {enquiry.message}
          </p>
          {enquiry.viewingRequested && (
            <p className="text-muted-foreground mt-2 text-sm">
              Viewing requested
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-xs">
            {enquiry.createdAt.toLocaleString('en-GB')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                type="button"
                variant={enquiry.status === status ? 'default' : 'secondary'}
                disabled={pendingId === enquiry.id || enquiry.status === status}
                onClick={() => updateStatus(enquiry.id, status)}
                className="h-8 rounded-[var(--radius-md)] px-3 text-xs capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
