import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FeatureChipInput } from '@/components/features/listings/wizard/feature-chip-input'

// M1-DESIGN-SPEC.md §1.4.
describe('FeatureChipInput', () => {
  it('shows the 8 suggested chips and the added-chips counter', () => {
    render(<FeatureChipInput value={[]} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Garden' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Off-street parking' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Period features' }),
    ).toBeInTheDocument()
    expect(screen.getByText('0 of 10 features added.')).toBeInTheDocument()
  })

  it('clicking a suggested chip adds it and removes it from the suggestion row', () => {
    const onChange = vi.fn()
    render(<FeatureChipInput value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Garden' }))

    expect(onChange).toHaveBeenCalledWith(['Garden'])
  })

  it('once added, a suggestion no longer appears in the suggestion row', () => {
    render(<FeatureChipInput value={['Garden']} onChange={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: 'Garden' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Garage' })).toBeInTheDocument()
  })

  it('typing a custom feature and clicking Add appends it', () => {
    const onChange = vi.fn()
    render(<FeatureChipInput value={['Garden']} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/add a feature/i), {
      target: { value: 'Home office' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).toHaveBeenCalledWith(['Garden', 'Home office'])
  })

  it('pressing Enter in the text field also adds the feature, without submitting a form', () => {
    const onChange = vi.fn()
    const formSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={formSubmit}>
        <FeatureChipInput value={[]} onChange={onChange} />
      </form>,
    )

    const input = screen.getByLabelText(/add a feature/i)
    fireEvent.change(input, { target: { value: 'Home office' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['Home office'])
    expect(formSubmit).not.toHaveBeenCalled()
  })

  it('does not add a blank or duplicate feature', () => {
    const onChange = vi.fn()
    render(<FeatureChipInput value={['Garden']} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/add a feature/i), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/add a feature/i), {
      target: { value: 'garden' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removing an added chip calls onChange without it, with an accessible label', () => {
    const onChange = vi.fn()
    render(
      <FeatureChipInput value={['Garden', 'Garage']} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove Garden' }))

    expect(onChange).toHaveBeenCalledWith(['Garage'])
  })

  it('disables the input and Add button at 10 features, and swaps the counter copy', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `Feature ${i + 1}`)
    render(<FeatureChipInput value={ten} onChange={vi.fn()} />)

    expect(
      screen.getByText("You've added the maximum of 10 features."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/add a feature/i)).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('does not add an 11th feature even if Add is clicked at the cap', () => {
    const onChange = vi.fn()
    const ten = Array.from({ length: 10 }, (_, i) => `Feature ${i + 1}`)
    render(<FeatureChipInput value={ten} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/add a feature/i), {
      target: { value: 'One too many' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
