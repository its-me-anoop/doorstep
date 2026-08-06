import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SortSelect } from '@/components/features/search/sort-select'
import type { SearchSort } from '@/lib/search-url'

// M2-DESIGN-SPEC.md §3.5 — native <select>, three options, "Newest
// first" the default.
describe('SortSelect', () => {
  it('shows the three sort options with the spec-exact labels', () => {
    render(<SortSelect value={undefined} onChange={vi.fn()} />)
    const select = screen.getByLabelText('Sort') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels).toEqual([
      'Newest first',
      'Price: low to high',
      'Price: high to low',
    ])
  })

  it('defaults to "newest" when value is undefined', () => {
    render(<SortSelect value={undefined} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Sort')).toHaveValue('newest')
  })

  it('calls onChange with the selected sort', () => {
    const onChange = vi.fn()
    render(<SortSelect value={undefined} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Sort'), {
      target: { value: 'price_asc' },
    })
    expect(onChange).toHaveBeenCalledWith('price_asc' satisfies SearchSort)
  })
})
