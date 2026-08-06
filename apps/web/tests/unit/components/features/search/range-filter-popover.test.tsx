import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RangeFilterPopover } from '@/components/features/search/range-filter-popover'

const OPTIONS = [
  { value: 100, label: '£100' },
  { value: 200, label: '£200' },
  { value: 300, label: '£300' },
]

// M2-DESIGN-SPEC.md §1.6 — the Price/Beds panel shape: two <select>s
// (Min/Max), Apply commits, Reset only shows once a value is set, and
// Max never offers a value at-or-below the pending Min.
describe('RangeFilterPopover', () => {
  it('shows "No min"/"No max" placeholder options plus every step', () => {
    render(
      <RangeFilterPopover
        label="Price"
        minLabel="Min price"
        maxLabel="Max price"
        min={undefined}
        max={undefined}
        options={OPTIONS}
        formatOption={(o) => o.label}
        onApply={vi.fn()}
        panelId="price-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Price' }))
    const minSelect = screen.getByLabelText('Min price') as HTMLSelectElement
    expect(Array.from(minSelect.options).map((o) => o.textContent)).toEqual([
      'No min',
      '£100',
      '£200',
      '£300',
    ])
  })

  it('omits Max options at or below the pending Min', () => {
    render(
      <RangeFilterPopover
        label="Price"
        minLabel="Min price"
        maxLabel="Max price"
        min={undefined}
        max={undefined}
        options={OPTIONS}
        formatOption={(o) => o.label}
        onApply={vi.fn()}
        panelId="price-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Price' }))
    fireEvent.change(screen.getByLabelText('Min price'), {
      target: { value: '200' },
    })
    const maxSelect = screen.getByLabelText('Max price') as HTMLSelectElement
    expect(Array.from(maxSelect.options).map((o) => o.textContent)).toEqual([
      'No max',
      '£300',
    ])
  })

  it('calls onApply with the pending min/max and closes on Apply', () => {
    const onApply = vi.fn()
    render(
      <RangeFilterPopover
        label="Price"
        minLabel="Min price"
        maxLabel="Max price"
        min={undefined}
        max={undefined}
        options={OPTIONS}
        formatOption={(o) => o.label}
        onApply={onApply}
        panelId="price-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Price' }))
    fireEvent.change(screen.getByLabelText('Min price'), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText('Max price'), {
      target: { value: '300' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(100, 300)
    expect(screen.queryByLabelText('Min price')).not.toBeInTheDocument()
  })

  it('does not show Reset when no value is set', () => {
    render(
      <RangeFilterPopover
        label="Price"
        minLabel="Min price"
        maxLabel="Max price"
        min={undefined}
        max={undefined}
        options={OPTIONS}
        formatOption={(o) => o.label}
        onApply={vi.fn()}
        panelId="price-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Price' }))
    expect(
      screen.queryByRole('button', { name: 'Reset' }),
    ).not.toBeInTheDocument()
  })

  it('shows Reset once a value is set, and Reset applies undefined/undefined', () => {
    const onApply = vi.fn()
    render(
      <RangeFilterPopover
        label="Price"
        minLabel="Min price"
        maxLabel="Max price"
        min={200}
        max={undefined}
        options={OPTIONS}
        formatOption={(o) => o.label}
        onApply={onApply}
        panelId="price-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /£200/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onApply).toHaveBeenCalledWith(undefined, undefined)
  })

  it('discards a pending edit that never hit Apply', () => {
    const onApply = vi.fn()
    render(
      <RangeFilterPopover
        label="Price"
        minLabel="Min price"
        maxLabel="Max price"
        min={undefined}
        max={undefined}
        options={OPTIONS}
        formatOption={(o) => o.label}
        onApply={onApply}
        panelId="price-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Price' }))
    fireEvent.change(screen.getByLabelText('Min price'), {
      target: { value: '200' },
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onApply).not.toHaveBeenCalled()
  })
})
