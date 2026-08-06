import { X } from 'lucide-react'

import type { Channel } from '@/domain/enums'
import {
  FURNISHED_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/components/features/listings/wizard/wizard-labels'
import type { SearchUrlState } from '@/lib/search-url'

interface FilterChipsProps {
  state: SearchUrlState
  channel: Channel
  onChange: (next: SearchUrlState) => void
}

interface Chip {
  id: string
  label: string
  remove: (state: SearchUrlState) => SearchUrlState
}

function bedsLabel(value: number): string {
  if (value === 0) return 'Studio'
  if (value === 6) return '6+'
  return `${value} ${value === 1 ? 'bed' : 'beds'}`
}

function priceChipLabel(min: number | undefined, max: number | undefined) {
  const formatted = (value: number) => `£${value.toLocaleString('en-GB')}`
  if (min !== undefined && max !== undefined) {
    return `${formatted(min)}–${formatted(max)}`
  }
  if (min !== undefined) return `From ${formatted(min)}`
  return `Up to ${formatted(max as number)}`
}

function bedsChipLabel(min: number | undefined, max: number | undefined) {
  if (min !== undefined && max !== undefined) {
    return `${bedsLabel(min)}–${bedsLabel(max)}`
  }
  if (min !== undefined) return `Min ${bedsLabel(min)}`
  return `Up to ${bedsLabel(max as number)}`
}

/** Up to 2 values join as their resolved labels; 3+ collapses to a
 * count (§1.1: "3+ collapses to '3 property types'... removing it clears
 * all type values at once"). Shared with Furnished for the same reason
 * MultiSelectFilterPopover's own trigger summary is shared. */
function multiValueChipLabel(
  values: readonly string[],
  labels: Record<string, string>,
  countNoun: string,
): string {
  if (values.length <= 2) {
    return values.map((value) => labels[value] ?? value).join(', ')
  }
  return `${values.length} ${countNoun}`
}

function formatDateChipLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

function buildChips(state: SearchUrlState, channel: Channel): Chip[] {
  const chips: Chip[] = []

  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    chips.push({
      id: 'price',
      label: priceChipLabel(state.minPrice, state.maxPrice),
      remove: (s) => ({ ...s, minPrice: undefined, maxPrice: undefined }),
    })
  }

  if (state.minBeds !== undefined || state.maxBeds !== undefined) {
    chips.push({
      id: 'beds',
      label: bedsChipLabel(state.minBeds, state.maxBeds),
      remove: (s) => ({ ...s, minBeds: undefined, maxBeds: undefined }),
    })
  }

  if (state.type && state.type.length > 0) {
    chips.push({
      id: 'type',
      label: multiValueChipLabel(
        state.type,
        PROPERTY_TYPE_LABELS as unknown as Record<string, string>,
        'property types',
      ),
      remove: (s) => ({ ...s, type: undefined }),
    })
  }

  if (channel === 'rent' && state.furnished && state.furnished.length > 0) {
    chips.push({
      id: 'furnished',
      label: multiValueChipLabel(
        state.furnished,
        FURNISHED_LABELS as unknown as Record<string, string>,
        'furnished options',
      ),
      remove: (s) => ({ ...s, furnished: undefined }),
    })
  }

  if (channel === 'rent' && state.availableFrom) {
    chips.push({
      id: 'availableFrom',
      label: `Available by ${formatDateChipLabel(state.availableFrom)}`,
      remove: (s) => ({ ...s, availableFrom: undefined }),
    })
  }

  return chips
}

/**
 * FilterChips — §1.1. A direct readout of the active query, one chip per
 * facet in filter-bar order (Price → Beds → Type → rent extras). Renders
 * nothing at all when no filters are active (no empty "no filters"
 * ghost row).
 */
export function FilterChips({ state, channel, onChange }: FilterChipsProps) {
  const chips = buildChips(state, channel)
  if (chips.length === 0) return null

  function clearAll() {
    let next = state
    for (const chip of chips) next = chip.remove(next)
    onChange(next)
  }

  return (
    <div className="mt-3 mb-6 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="bg-clay-050 text-clay-600 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-sm font-medium"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label} filter`}
            onClick={() => onChange(chip.remove(state))}
            className="text-clay-600 hover:text-clay-600/70 -m-2.5 flex size-11 items-center justify-center"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </span>
      ))}

      {chips.length >= 2 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
