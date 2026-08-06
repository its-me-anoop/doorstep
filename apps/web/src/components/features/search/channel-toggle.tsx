'use client'

import { useRouter } from 'next/navigation'
import { startTransition } from 'react'

import type { Channel } from '@/domain/enums'
import { ChannelSegmentedControl } from '@/components/features/search/channel-segmented-control'
import {
  buildSearchHref,
  resetStateForChannelSwitch,
  type SearchUrlState,
} from '@/lib/search-url'

interface ChannelToggleProps {
  channel: Channel
  state: SearchUrlState
  /** The current page's own path (`/for-sale`, `/for-sale/search`,
   * `/for-sale/{area}`) — the other channel's path is this with its
   * leading `for-sale`/`to-rent` segment swapped. */
  basePath: string
  className?: string
  size?: 'lg' | 'md'
}

function otherChannelBasePath(basePath: string, target: Channel): string {
  return basePath.replace(
    /^\/(for-sale|to-rent)/,
    `/${target === 'sale' ? 'for-sale' : 'to-rent'}`,
  )
}

/**
 * ChannelToggle — the results page's navigating Buy/Rent toggle (§3.2).
 * Wraps `ChannelSegmentedControl` with the channel-switch reset rule
 * (§1.2/§3.2) and a `startTransition`-wrapped navigation; see that
 * component's own doc comment for why the visual and the navigation
 * behaviour are split.
 */
export function ChannelToggle({
  channel,
  state,
  basePath,
  className,
  size = 'md',
}: ChannelToggleProps) {
  const router = useRouter()

  function handleSelect(target: Channel) {
    if (target === channel) return
    const nextState = resetStateForChannelSwitch(state)
    const href = buildSearchHref(
      otherChannelBasePath(basePath, target),
      nextState,
    )
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <ChannelSegmentedControl
      value={channel}
      onChange={handleSelect}
      size={size}
      className={className}
    />
  )
}
