import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AvailableByFilter } from '@/components/features/search/available-by-filter'

// M2-DESIGN-SPEC.md §1.5 — "Available by": a date input with helper
// copy stating the `<=` direction explicitly, plus a "Now" quick-set.
describe('AvailableByFilter', () => {
  it('shows the helper text explaining the <= direction', () => {
    render(
      <AvailableByFilter
        value={undefined}
        onApply={vi.fn()}
        today="2026-08-06"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Available by' }))
    expect(
      screen.getByText(
        'Show homes available to move into on or before this date.',
      ),
    ).toBeInTheDocument()
  })

  it('the "Now" button sets the date field to today', () => {
    render(
      <AvailableByFilter
        value={undefined}
        onApply={vi.fn()}
        today="2026-08-06"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Available by' }))
    fireEvent.click(screen.getByRole('button', { name: 'Now' }))
    expect(screen.getByLabelText('Available by')).toHaveValue('2026-08-06')
  })

  it('calls onApply with the chosen date and closes on Apply', () => {
    const onApply = vi.fn()
    render(
      <AvailableByFilter
        value={undefined}
        onApply={onApply}
        today="2026-08-06"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Available by' }))
    fireEvent.change(screen.getByLabelText('Available by'), {
      target: { value: '2026-09-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith('2026-09-01')
    expect(screen.queryByLabelText('Available by')).not.toBeInTheDocument()
  })

  it('shows Reset once a date is set, applying undefined', () => {
    const onApply = vi.fn()
    render(
      <AvailableByFilter
        value="2026-09-01"
        onApply={onApply}
        today="2026-08-06"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /By 2026-09-01/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onApply).toHaveBeenCalledWith(undefined)
  })
})
