'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface DeleteSavedSearchButtonProps {
  searchId: string
}

export function DeleteSavedSearchButton({
  searchId,
}: DeleteSavedSearchButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    try {
      await fetch(`/api/v1/me/saved-searches/${searchId}`, {
        method: 'DELETE',
      })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={handleDelete}
      className="h-9 rounded-[var(--radius-md)] px-4"
    >
      Remove
    </Button>
  )
}
