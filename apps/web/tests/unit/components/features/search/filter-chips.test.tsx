import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FilterChips } from '@/components/features/search/filter-chips'
import type { SearchUrlState } from '@/lib/search-url'

// M2-DESIGN-SPEC.md §1.1 — filter chip anatomy: resolved-value labels,
// individually removable, "Clear all" only once 2+ are present, and the
// row renders nothing at all when no filters are active.
describe('FilterChips', () => {
  it('renders nothing when no filters are active', () => {
    const { container } = render(
      <FilterChips state={{}} channel="sale" onChange={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a resolved-value price chip, not the raw param', () => {
    render(
      <FilterChips
        state={{ maxPrice: 400000 }}
        channel="sale"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Up to £400,000')).toBeInTheDocument()
  })

  it('shows a resolved-value beds chip', () => {
    render(
      <FilterChips state={{ minBeds: 2 }} channel="sale" onChange={vi.fn()} />,
    )
    expect(screen.getByText('Min 2 beds')).toBeInTheDocument()
  })

  it('collapses a 2-value type chip to the joined labels', () => {
    render(
      <FilterChips
        state={{ type: ['flat', 'terraced'] }}
        channel="sale"
        onChange={vi.fn()}
      />,
    )
    expect(
      screen.getByText('Flat or apartment, Terraced house'),
    ).toBeInTheDocument()
  })

  it('collapses a 3+ value type chip to a count', () => {
    render(
      <FilterChips
        state={{ type: ['flat', 'terraced', 'detached'] }}
        channel="sale"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('3 property types')).toBeInTheDocument()
  })

  it('shows a furnished chip only on the rent channel', () => {
    render(
      <FilterChips
        state={{ furnished: ['furnished'] }}
        channel="rent"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Furnished')).toBeInTheDocument()
  })

  it('does not show a filter chip for zero chips even with only a single one active (single-chip case has no "Clear all")', () => {
    render(
      <FilterChips state={{ minBeds: 2 }} channel="sale" onChange={vi.fn()} />,
    )
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('shows "Clear all" once 2+ chips are present, clearing every filter but keeping location/sort/page', () => {
    const onChange = vi.fn()
    const state: SearchUrlState = {
      minBeds: 2,
      maxPrice: 400000,
      lat: 51.454,
      lng: -0.9788,
      sort: 'price_asc',
    }
    render(<FilterChips state={state} channel="sale" onChange={onChange} />)
    fireEvent.click(screen.getByText('Clear all'))
    expect(onChange).toHaveBeenCalledWith({
      lat: 51.454,
      lng: -0.9788,
      sort: 'price_asc',
    })
  })

  it('removes only the clicked chip, preserving the rest of the state', () => {
    const onChange = vi.fn()
    render(
      <FilterChips
        state={{ minBeds: 2, maxPrice: 400000 }}
        channel="sale"
        onChange={onChange}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Min 2 beds filter' }),
    )
    expect(onChange).toHaveBeenCalledWith({ maxPrice: 400000 })
  })
})
