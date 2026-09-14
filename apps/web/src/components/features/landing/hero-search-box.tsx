'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import type { Channel } from '@/domain/enums'
import { ChannelSegmentedControl } from '@/components/features/search/channel-segmented-control'
import { PlainEnglishSearch } from '@/components/features/search/plain-english/plain-english-search'
import { SearchCombobox } from '@/components/features/search/search-combobox'
import { Button } from '@/components/ui/button'

const UNRESTRICTED_HREF: Record<Channel, string> = {
  sale: '/for-sale',
  rent: '/to-rent',
}

/**
 * HeroSearchBox — the landing hero's primary interactive element
 * (§2.1), replacing the old CTA row: channel toggle + the large
 * combobox + a Search button, reading as one continuous instrument at
 * desktop width (single shared border) and stacking at mobile widths
 * (§2.1's own responsive rule).
 *
 * Selecting a combobox suggestion navigates on its own (SearchCombobox's
 * own responsibility, §1.9). This component only owns the "no location
 * typed, no suggestion picked" fallback the spec calls out explicitly:
 * submitting sends the visitor to the current channel's unrestricted
 * tier rather than blocking with a "please enter a location" error
 * (SRCH-1's "never an error page" spirit).
 */
export function HeroSearchBox() {
  const router = useRouter()
  const [channel, setChannel] = useState<Channel>('sale')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.push(UNRESTRICTED_HREF[channel])
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="sm:border-input flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0 sm:overflow-hidden sm:rounded-[var(--radius-md)] sm:border">
          <ChannelSegmentedControl
            value={channel}
            onChange={setChannel}
            size="lg"
            bordered={false}
            className="sm:rounded-none"
          />
          <SearchCombobox channel={channel} size="lg" />
          <Button
            type="submit"
            className="h-12 rounded-[var(--radius-md)] px-6 sm:rounded-none md:h-14"
          >
            Search
          </Button>
        </div>
      </form>
      {/* The second way in: a sentence instead of a postcode. Its own
          <form>, so it sits beside the combobox's rather than inside it,
          and follows the hero's channel toggle unless the sentence itself
          says "to rent"/"for sale". */}
      <PlainEnglishSearch channel={channel} />
    </div>
  )
}
