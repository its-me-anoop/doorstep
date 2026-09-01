'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { User } from '@/ports/user-repository'

interface UserAdminActionsProps {
  user: User
}

export function UserAdminActions({ user }: UserAdminActionsProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function manage(
    action: 'suspend' | 'reinstate' | 'ban',
    reason?: string,
  ) {
    setPending(true)
    try {
      await fetch('/api/v1/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action, reason }),
      })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {user.status !== 'active' && (
        <Button
          type="button"
          disabled={pending}
          onClick={() => manage('reinstate')}
          className="h-8 rounded-[var(--radius-md)] px-3 text-xs"
        >
          Reinstate
        </Button>
      )}
      {user.status === 'active' && (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => manage('suspend', 'Admin action')}
          className="h-8 rounded-[var(--radius-md)] px-3 text-xs"
        >
          Suspend
        </Button>
      )}
      {user.status !== 'banned' && (
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => manage('ban', 'Admin action')}
          className="h-8 rounded-[var(--radius-md)] px-3 text-xs"
        >
          Ban
        </Button>
      )}
    </div>
  )
}
