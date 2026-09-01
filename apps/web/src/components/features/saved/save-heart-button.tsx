'use client'

import { Heart } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SaveHeartButtonProps {
  propertyId: string
  initialSaved?: boolean
  signedIn: boolean
  className?: string
  /** Stop click from bubbling to parent links. */
  stopPropagation?: boolean
}

export function SaveHeartButton({
  propertyId,
  initialSaved = false,
  signedIn,
  className,
  stopPropagation = false,
}: SaveHeartButtonProps) {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, setPending] = useState(false)

  const toggle = useCallback(
    async (event: React.MouseEvent) => {
      if (stopPropagation) {
        event.preventDefault()
        event.stopPropagation()
      }

      if (!signedIn) {
        window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname)}`
        return
      }

      if (pending) return
      setPending(true)

      try {
        if (saved) {
          const response = await fetch(
            `/api/v1/me/saved-properties/${propertyId}`,
            { method: 'DELETE' },
          )
          if (response.ok) setSaved(false)
        } else {
          const response = await fetch(
            `/api/v1/me/saved-properties/${propertyId}`,
            { method: 'PUT' },
          )
          if (response.ok) setSaved(true)
        }
      } finally {
        setPending(false)
      }
    },
    [pending, propertyId, saved, signedIn, stopPropagation],
  )

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-pressed={saved}
      aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}
      disabled={pending}
      onClick={toggle}
      className={cn(
        'bg-card/90 text-foreground size-11 rounded-[var(--radius-md)] shadow-sm backdrop-blur-sm',
        saved && 'text-primary',
        className,
      )}
    >
      <Heart className={cn('size-5', saved && 'fill-current')} />
    </Button>
  )
}
