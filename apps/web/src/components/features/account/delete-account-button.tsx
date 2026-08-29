'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export function DeleteAccountButton() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDelete() {
    setPending(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/v1/me', { method: 'DELETE' })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(body?.error?.message ?? 'Could not delete account.')
      }
      router.push('/')
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not delete account.',
      )
      setPending(false)
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirming(true)}
        className="h-11 rounded-[var(--radius-md)] px-6"
      >
        Delete account
      </Button>
    )
  }

  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-[var(--radius-md)] border p-4">
      <p className="text-foreground text-sm leading-relaxed">
        This permanently deletes your Doorstep account, saved favourites,
        and saved searches. Your listings will be hidden or removed. This
        cannot be undone.
      </p>
      {errorMessage && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={handleDelete}
          className="h-11 rounded-[var(--radius-md)] px-6"
        >
          {pending ? 'Deleting…' : 'Yes, delete my account'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="h-11 rounded-[var(--radius-md)] px-6"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
