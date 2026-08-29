'use client'

import { Bookmark } from 'lucide-react'
import { useCallback, useState } from 'react'

import type { Channel } from '@/domain/enums'
import { milesToMetres } from '@/domain/distance'
import type { SavedSearchCriteria } from '@/domain/saved'
import { Button } from '@/components/ui/button'
import type { SearchUrlState } from '@/lib/search-url'
import { cn } from '@/lib/utils'

interface SaveSearchButtonProps {
  channel: Channel
  state: SearchUrlState
  signedIn: boolean
  className?: string
}

/** Maps public URL search state to the saved-search API shape. */
export function searchUrlStateToSavedSearchCriteria(
  channel: Channel,
  state: SearchUrlState,
): SavedSearchCriteria {
  const filters: Record<string, unknown> = {}

  if (state.minPrice !== undefined) filters.minPrice = state.minPrice
  if (state.maxPrice !== undefined) filters.maxPrice = state.maxPrice
  if (state.minBeds !== undefined) filters.minBeds = state.minBeds
  if (state.maxBeds !== undefined) filters.maxBeds = state.maxBeds
  if (state.type !== undefined && state.type.length > 0) filters.types = state.type
  if (state.furnished !== undefined && state.furnished.length > 0) {
    filters.furnished = state.furnished
  }
  if (state.availableFrom !== undefined) {
    filters.availableFrom = state.availableFrom
  }
  if (state.sort !== undefined) filters.sort = state.sort

  return {
    channel,
    locationLabel: state.label?.trim() || 'Current search',
    location:
      state.lat !== undefined && state.lng !== undefined
        ? { lat: state.lat, lng: state.lng }
        : null,
    radiusMetres:
      state.radius !== undefined ? milesToMetres(state.radius) : null,
    filters,
  }
}

export function SaveSearchButton({
  channel,
  state,
  signedIn,
  className,
}: SaveSearchButtonProps) {
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = useCallback(async () => {
    if (!signedIn) {
      window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
      return
    }

    if (pending) return

    const criteria = searchUrlStateToSavedSearchCriteria(channel, state)
    const defaultName = criteria.locationLabel
    const name = window.prompt('Name this search', defaultName)?.trim()
    if (!name) return

    setPending(true)
    try {
      const response = await fetch('/api/v1/me/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, criteria }),
      })
      if (response.ok) setSaved(true)
    } finally {
      setPending(false)
    }
  }, [channel, pending, signedIn, state])

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending || saved}
      onClick={save}
      className={cn(
        'h-9 gap-2 rounded-[var(--radius-md)] px-4',
        saved && 'text-primary',
        className,
      )}
    >
      <Bookmark className={cn('size-4', saved && 'fill-current')} />
      {saved ? 'Search saved' : 'Save search'}
    </Button>
  )
}
