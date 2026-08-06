'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterPopover } from '@/components/features/search/filter-popover'

interface AvailableByFilterProps {
  value: string | undefined
  onApply: (value: string | undefined) => void
  /** `YYYY-MM-DD` for today — a prop (not read from `Date` inline) so
   * the "Now" quick-set is deterministic and testable, same reasoning as
   * ResultCard's `now` prop. */
  today: string
}

/**
 * AvailableByFilter — the rent-only "Available by" panel (§1.5). A
 * single date input, not a Min/Max range or a checkbox list, so it gets
 * its own small panel body rather than being forced through
 * RangeFilterPopover or MultiSelectFilterPopover. The helper copy states
 * the filter's `<=` direction explicitly ("available to move into on or
 * before this date," not "available on exactly this date") so Tom isn't
 * confused about which way the comparison runs.
 */
export function AvailableByFilter({
  value,
  onApply,
  today,
}: AvailableByFilterProps) {
  const isActive = value !== undefined

  return (
    <FilterPopover
      label="Available by"
      summary={isActive ? `By ${value}` : undefined}
      isActive={isActive}
      panelId="available-by-panel"
    >
      {({ close }) => (
        <AvailableByPanelBody
          value={value}
          today={today}
          isActive={isActive}
          onApply={(next) => {
            onApply(next)
            close()
          }}
        />
      )}
    </FilterPopover>
  )
}

function AvailableByPanelBody({
  value,
  today,
  isActive,
  onApply,
}: {
  value: string | undefined
  today: string
  isActive: boolean
  onApply: (value: string | undefined) => void
}) {
  const [pending, setPending] = useState(value ?? '')

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Available by
        <Input
          aria-label="Available by"
          type="date"
          value={pending}
          onChange={(event) => setPending(event.target.value)}
        />
      </label>
      <p className="text-muted-foreground text-sm leading-snug">
        Show homes available to move into on or before this date.
      </p>
      <button
        type="button"
        onClick={() => setPending(today)}
        className="text-primary w-fit text-sm font-medium"
      >
        Now
      </button>

      <div className="flex items-center justify-between gap-2">
        {isActive ? (
          <button
            type="button"
            onClick={() => onApply(undefined)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Reset
          </button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => onApply(pending === '' ? undefined : pending)}
          className="h-9 rounded-[var(--radius-md)] px-4"
        >
          Apply
        </Button>
      </div>
    </div>
  )
}
