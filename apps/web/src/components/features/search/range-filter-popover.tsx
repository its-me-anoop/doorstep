'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FilterPopover } from '@/components/features/search/filter-popover'

interface RangeOption {
  value: number
}

interface RangeFilterPopoverProps<T extends RangeOption> {
  label: string
  minLabel: string
  maxLabel: string
  min: number | undefined
  max: number | undefined
  options: readonly T[]
  formatOption: (option: T) => string
  onApply: (min: number | undefined, max: number | undefined) => void
  /** Price's Max list omits any step at-or-below the pending Min
   * (§1.2); Beds deliberately does NOT do this — Min and Max share one
   * static list "for implementation simplicity" (§1.3). Default `true`
   * matches Price, the primary case; BedsFilter passes `false`. */
  filterMaxByMin?: boolean
  panelId: string
}

/**
 * RangeFilterPopover — the shared Min/Max panel shape behind both the
 * Price and Beds filter triggers (§1.6: "Price/Beds panels: two
 * `<select>`s side by side (Min/Max), a compact Apply button... and a
 * quiet Reset text link"). One generic component parameterised by the
 * option list rather than two near-identical ones, per OCP — a third
 * stepped-range filter later extends this by passing new `options`, not
 * by copy-pasting the panel.
 */
export function RangeFilterPopover<T extends RangeOption>({
  label,
  minLabel,
  maxLabel,
  min,
  max,
  options,
  formatOption,
  onApply,
  filterMaxByMin = true,
  panelId,
}: RangeFilterPopoverProps<T>) {
  const isActive = min !== undefined || max !== undefined

  return (
    <FilterPopover
      label={label}
      summary={
        isActive ? summaryFor(min, max, options, formatOption) : undefined
      }
      isActive={isActive}
      panelId={panelId}
    >
      {({ close }) => (
        <RangePanelBody
          minLabel={minLabel}
          maxLabel={maxLabel}
          min={min}
          max={max}
          options={options}
          formatOption={formatOption}
          filterMaxByMin={filterMaxByMin}
          isActive={isActive}
          onApply={(nextMin, nextMax) => {
            onApply(nextMin, nextMax)
            close()
          }}
        />
      )}
    </FilterPopover>
  )
}

function summaryFor<T extends RangeOption>(
  min: number | undefined,
  max: number | undefined,
  options: readonly T[],
  formatOption: (option: T) => string,
): string {
  const minOption = options.find((o) => o.value === min)
  const maxOption = options.find((o) => o.value === max)
  const minText = minOption ? formatOption(minOption) : 'Any'
  const maxText = maxOption ? formatOption(maxOption) : 'Any'
  if (min !== undefined && max !== undefined) return `${minText}–${maxText}`
  if (min !== undefined) return `${minText}+`
  if (max !== undefined) return `Up to ${maxText}`
  return 'Any'
}

interface RangePanelBodyProps<T extends RangeOption> {
  minLabel: string
  maxLabel: string
  min: number | undefined
  max: number | undefined
  options: readonly T[]
  formatOption: (option: T) => string
  filterMaxByMin: boolean
  isActive: boolean
  onApply: (min: number | undefined, max: number | undefined) => void
}

function RangePanelBody<T extends RangeOption>({
  minLabel,
  maxLabel,
  min,
  max,
  options,
  formatOption,
  filterMaxByMin,
  isActive,
  onApply,
}: RangePanelBodyProps<T>) {
  // Freshly initialised from the committed value every time the panel
  // mounts (FilterPopover unmounts it on close) — this IS the "local
  // until Apply" behaviour, no extra reset bookkeeping needed.
  const [pendingMin, setPendingMin] = useState(min)
  const [pendingMax, setPendingMax] = useState(max)

  const maxOptions =
    filterMaxByMin && pendingMin !== undefined
      ? options.filter((o) => o.value > pendingMin)
      : options

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          {minLabel}
          <Select
            aria-label={minLabel}
            value={pendingMin ?? ''}
            onChange={(event) => {
              const value = event.target.value
              setPendingMin(value === '' ? undefined : Number(value))
            }}
          >
            <option value="">No min</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {formatOption(option)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          {maxLabel}
          <Select
            aria-label={maxLabel}
            value={pendingMax ?? ''}
            onChange={(event) => {
              const value = event.target.value
              setPendingMax(value === '' ? undefined : Number(value))
            }}
          >
            <option value="">No max</option>
            {maxOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {formatOption(option)}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        {isActive ? (
          <button
            type="button"
            onClick={() => onApply(undefined, undefined)}
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
          onClick={() => onApply(pendingMin, pendingMax)}
          className="h-9 rounded-[var(--radius-md)] px-4"
        >
          Apply
        </Button>
      </div>
    </div>
  )
}
