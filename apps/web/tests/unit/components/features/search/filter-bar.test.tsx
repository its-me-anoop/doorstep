import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FilterBar } from '@/components/features/search/filter-bar'

// M2-DESIGN-SPEC.md §3.3 — Price/Beds/Type always; Furnished/Available
// by appended only on /to-rent.
describe('FilterBar', () => {
  it('shows Price, Beds and Type triggers, and no rent-only triggers, on sale', () => {
    render(
      <FilterBar
        channel="sale"
        state={{}}
        onChange={vi.fn()}
        today="2026-08-06"
      />,
    )
    expect(screen.getByRole('button', { name: 'Price' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beds' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Furnished' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Available by' }),
    ).not.toBeInTheDocument()
  })

  it('adds Furnished and Available by triggers on rent', () => {
    render(
      <FilterBar
        channel="rent"
        state={{}}
        onChange={vi.fn()}
        today="2026-08-06"
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Furnished' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Available by' }),
    ).toBeInTheDocument()
  })

  it('applying a price range calls onChange with the patched state', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        channel="sale"
        state={{}}
        onChange={onChange}
        today="2026-08-06"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Price' }))
    fireEvent.change(screen.getByLabelText('Min price'), {
      target: { value: '250000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onChange).toHaveBeenCalledWith({
      minPrice: 250000,
      maxPrice: undefined,
    })
  })

  it('applying a type selection calls onChange with the patched state', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        channel="sale"
        state={{}}
        onChange={onChange}
        today="2026-08-06"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    fireEvent.click(screen.getByLabelText('Flat or apartment'))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onChange).toHaveBeenCalledWith({ type: ['flat'] })
  })
})
