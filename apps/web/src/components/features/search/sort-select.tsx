import { Select } from '@/components/ui/select'
import type { SearchSort } from '@/lib/search-url'

interface SortSelectProps {
  value: SearchSort | undefined
  onChange: (sort: SearchSort) => void
}

const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

/**
 * SortSelect — §3.5. Native `<select>`, right-aligned opposite the
 * result count. `value` is `SearchUrlState['sort']`, which is `undefined`
 * for the default (never carries the literal `'newest'` — see
 * lib/search-url.ts's canonicalisation), so this component is the one
 * place that re-adds the default back in for the control's own display
 * value.
 */
export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      Sort:
      <Select
        aria-label="Sort"
        className="h-11 w-auto"
        value={value ?? 'newest'}
        onChange={(event) => onChange(event.target.value as SearchSort)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}
