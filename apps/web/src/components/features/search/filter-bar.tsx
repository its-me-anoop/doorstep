'use client'

import type { Channel, Furnished, PropertyType } from '@/domain/enums'
import {
  BEDROOM_OPTIONS,
  FURNISHED_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/components/features/listings/wizard/wizard-labels'
import { AvailableByFilter } from '@/components/features/search/available-by-filter'
import { MultiSelectFilterPopover } from '@/components/features/search/multi-select-filter-popover'
import { RangeFilterPopover } from '@/components/features/search/range-filter-popover'
import { priceStepsForChannel } from '@/lib/search-price-steps'
import type { SearchUrlState } from '@/lib/search-url'
import { PROPERTY_TYPE, FURNISHED } from '@/lib/validation/listing'

interface FilterBarProps {
  channel: Channel
  state: SearchUrlState
  onChange: (next: SearchUrlState) => void
  /** `YYYY-MM-DD` — threaded down to AvailableByFilter's "Now" button. */
  today: string
}

const TYPE_OPTIONS = PROPERTY_TYPE.options.map((value) => ({
  value,
  label: PROPERTY_TYPE_LABELS[value],
}))

const FURNISHED_OPTIONS = FURNISHED.options.map((value) => ({
  value,
  label: FURNISHED_LABELS[value],
}))

function formatPriceOption(channel: Channel) {
  return (value: number) =>
    channel === 'rent'
      ? `£${value.toLocaleString('en-GB')} pcm`
      : `£${value.toLocaleString('en-GB')}`
}

/**
 * FilterBar — §1.6/§3.3. Four (sale) or five (rent) trigger buttons in a
 * single wrapping row. Each trigger is one of the two generic panel
 * primitives (RangeFilterPopover, MultiSelectFilterPopover) or
 * AvailableByFilter's own small panel — this component's only job is
 * composition and wiring each Apply back into one `SearchUrlState`
 * patch, never its own filter logic.
 */
export function FilterBar({ channel, state, onChange, today }: FilterBarProps) {
  const priceSteps = priceStepsForChannel(channel).map((value) => ({ value }))

  return (
    <div className="flex [scroll-snap-type:x_mandatory] flex-wrap gap-3 overflow-x-auto pb-1 sm:overflow-visible">
      <RangeFilterPopover
        label="Price"
        minLabel="Min price"
        maxLabel="Max price"
        min={state.minPrice}
        max={state.maxPrice}
        options={priceSteps}
        formatOption={(o) => formatPriceOption(channel)(o.value)}
        filterMaxByMin
        panelId="price-filter-panel"
        onApply={(min, max) =>
          onChange({ ...state, minPrice: min, maxPrice: max })
        }
      />

      <RangeFilterPopover
        label="Beds"
        minLabel="Min beds"
        maxLabel="Max beds"
        min={state.minBeds}
        max={state.maxBeds}
        options={BEDROOM_OPTIONS}
        formatOption={(o) => o.label}
        filterMaxByMin={false}
        panelId="beds-filter-panel"
        onApply={(min, max) =>
          onChange({ ...state, minBeds: min, maxBeds: max })
        }
      />

      <MultiSelectFilterPopover
        label="Type"
        options={TYPE_OPTIONS}
        selected={state.type ?? []}
        panelId="type-filter-panel"
        onApply={(values) =>
          onChange({
            ...state,
            type: values.length > 0 ? (values as PropertyType[]) : undefined,
          })
        }
      />

      {channel === 'rent' && (
        <MultiSelectFilterPopover
          label="Furnished"
          options={FURNISHED_OPTIONS}
          selected={state.furnished ?? []}
          panelId="furnished-filter-panel"
          onApply={(values) =>
            onChange({
              ...state,
              furnished:
                values.length > 0 ? (values as Furnished[]) : undefined,
            })
          }
        />
      )}

      {channel === 'rent' && (
        <AvailableByFilter
          value={state.availableFrom}
          today={today}
          onApply={(value) => onChange({ ...state, availableFrom: value })}
        />
      )}
    </div>
  )
}
