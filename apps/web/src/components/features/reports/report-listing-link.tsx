'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const REASONS = [
  'Misleading information',
  'Suspected scam',
  'Offensive content',
  'Duplicate listing',
  'Other',
] as const

interface ReportListingLinkProps {
  propertyId: string
  signedIn: boolean
  defaultEmail?: string
}

export function ReportListingLink({
  propertyId,
  signedIn,
  defaultEmail = '',
}: ReportListingLinkProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REASONS[0])
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState(defaultEmail)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          reason,
          details: details || null,
          reporterEmail: signedIn ? undefined : email || null,
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(body?.error?.message ?? 'Could not submit report.')
      }

      setStatus('done')
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not submit report.',
      )
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 hover:underline"
      >
        Report this listing
      </button>
    )
  }

  if (status === 'done') {
    return (
      <p className="text-muted-foreground text-sm">
        Thanks — we have received your report and will review it shortly.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border mt-4 rounded-[var(--radius-md)] border p-4"
    >
      <p className="text-foreground text-sm font-medium">Report this listing</p>

      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor="report-reason">Reason</Label>
        <select
          id="report-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="border-input h-10 rounded-lg border bg-transparent px-2.5 text-sm"
        >
          {REASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor="report-details">Details (optional)</Label>
        <Textarea
          id="report-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={3}
        />
      </div>

      {!signedIn && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="report-email">Your email</Label>
          <Input
            id="report-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      )}

      {errorMessage && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={status === 'submitting'}
          className="h-9 rounded-[var(--radius-md)] px-4"
        >
          Submit report
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(false)}
          className="h-9 rounded-[var(--radius-md)] px-4"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
