import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MultiSelectFilterPopover } from '@/components/features/search/multi-select-filter-popover'

const OPTIONS = [
  { value: 'flat', label: 'Flat or apartment' },
  { value: 'terraced', label: 'Terraced house' },
  { value: 'detached', label: 'Detached house' },
]

// M2-DESIGN-SPEC.md §1.4/§1.6 — the Type/Furnished checkbox-list panel.
describe('MultiSelectFilterPopover', () => {
  it('renders each option as a labelled checkbox', () => {
    render(
      <MultiSelectFilterPopover
        label="Type"
        options={OPTIONS}
        selected={[]}
        onApply={vi.fn()}
        panelId="type-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    expect(screen.getByLabelText('Flat or apartment')).toBeInTheDocument()
    expect(screen.getByLabelText('Terraced house')).toBeInTheDocument()
  })

  it('checks the boxes matching the committed `selected` values on open', () => {
    render(
      <MultiSelectFilterPopover
        label="Type"
        options={OPTIONS}
        selected={['flat']}
        onApply={vi.fn()}
        panelId="type-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Flat or apartment/ }))
    expect(screen.getByLabelText('Flat or apartment')).toBeChecked()
    expect(screen.getByLabelText('Terraced house')).not.toBeChecked()
  })

  it('calls onApply with the toggled selection and closes on Apply', () => {
    const onApply = vi.fn()
    render(
      <MultiSelectFilterPopover
        label="Type"
        options={OPTIONS}
        selected={[]}
        onApply={onApply}
        panelId="type-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    fireEvent.click(screen.getByLabelText('Flat or apartment'))
    fireEvent.click(screen.getByLabelText('Detached house'))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(['flat', 'detached'])
    expect(screen.queryByLabelText('Flat or apartment')).not.toBeInTheDocument()
  })

  it('collapses the trigger summary to "N property types" style copy for 3+ (mirrors the chip rule)', () => {
    render(
      <MultiSelectFilterPopover
        label="Type"
        options={OPTIONS}
        selected={['flat', 'terraced', 'detached']}
        onApply={vi.fn()}
        panelId="type-panel"
      />,
    )
    expect(
      screen.getByRole('button', { name: /3 selected/ }),
    ).toBeInTheDocument()
  })

  it('shows the plain joined labels for 1-2 selected values', () => {
    render(
      <MultiSelectFilterPopover
        label="Type"
        options={OPTIONS}
        selected={['flat', 'terraced']}
        onApply={vi.fn()}
        panelId="type-panel"
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Flat or apartment, Terraced house' }),
    ).toBeInTheDocument()
  })

  it('shows Reset only once a value is selected', () => {
    const { rerender } = render(
      <MultiSelectFilterPopover
        label="Type"
        options={OPTIONS}
        selected={[]}
        onApply={vi.fn()}
        panelId="type-panel"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    expect(
      screen.queryByRole('button', { name: 'Reset' }),
    ).not.toBeInTheDocument()

    rerender(
      <MultiSelectFilterPopover
        label="Type"
        options={OPTIONS}
        selected={['flat']}
        onApply={vi.fn()}
        panelId="type-panel"
      />,
    )
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
  })
})
