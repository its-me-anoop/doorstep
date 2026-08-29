'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Report } from '@/ports/report-repository'

interface ReportActionsProps {
  report: Report
}

export function ReportActions({ report }: ReportActionsProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function resolve(status: 'resolved' | 'dismissed') {
    setPending(true)
    try {
      await fetch(`/api/v1/admin/reports/${report.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => resolve('resolved')}
        className="h-8 rounded-[var(--radius-md)] px-3 text-xs"
      >
        Resolve
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => resolve('dismissed')}
        className="h-8 rounded-[var(--radius-md)] px-3 text-xs"
      >
        Dismiss
      </Button>
    </div>
  )
}
