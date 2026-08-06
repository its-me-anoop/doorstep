'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FilterPopover } from '@/components/features/search/filter-popover'

interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectFilterPopoverProps {
  label: string
  options: readonly MultiSelectOption[]
  selected: readonly string[]
  onApply: (values: string[]) => void
  panelId: string
}

/**
 * Trigger summary rule shared with the filter-chip collapsing rule
 * (§1.1): up to 2 values join as plain labels, 3+ collapses to a count
 * ("3 property types" style, generalised here to "N selected" since this
 * component also renders Furnished, not just Type).
 */
function summaryFor(
  selected: readonly string[],
  options: readonly MultiSelectOption[],
): string | undefined {
  if (selected.length === 0) return undefined
  if (selected.length <= 2) {
    return selected
      .map((value) => options.find((o) => o.value === value)?.label ?? value)
      .join(', ')
  }
  return `${selected.length} selected`
}

/**
 * MultiSelectFilterPopover — the shared checkbox-list panel shape behind
 * the Type (§1.4) and Furnished (§1.5) filter triggers. Each option is a
 * real `<label>` + native `<input type="checkbox">` (Checkbox,
 * components/ui/checkbox.tsx — reused verbatim), 44px row height for
 * touch.
 */
export function MultiSelectFilterPopover({
  label,
  options,
  selected,
  onApply,
  panelId,
}: MultiSelectFilterPopoverProps) {
  const isActive = selected.length > 0

  return (
    <FilterPopover
      label={label}
      summary={summaryFor(selected, options)}
      isActive={isActive}
      panelId={panelId}
    >
      {({ close }) => (
        <MultiSelectPanelBody
          options={options}
          selected={selected}
          isActive={isActive}
          onApply={(values) => {
            onApply(values)
            close()
          }}
        />
      )}
    </FilterPopover>
  )
}

interface MultiSelectPanelBodyProps {
  options: readonly MultiSelectOption[]
  selected: readonly string[]
  isActive: boolean
  onApply: (values: string[]) => void
}

function MultiSelectPanelBody({
  options,
  selected,
  isActive,
  onApply,
}: MultiSelectPanelBodyProps) {
  const [pending, setPending] = useState<Set<string>>(new Set(selected))

  function toggle(value: string) {
    setPending((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {options.map((option) => (
          <li key={option.value}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={pending.has(option.value)}
                onChange={() => toggle(option.value)}
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2">
        {isActive ? (
          <button
            type="button"
            onClick={() => onApply([])}
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
          onClick={() => onApply([...pending])}
          className="h-9 rounded-[var(--radius-md)] px-4"
        >
          Apply
        </Button>
      </div>
    </div>
  )
}
