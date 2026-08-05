import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { StepIndicator } from '@/components/features/listings/wizard/step-indicator'

// M1-DESIGN-SPEC.md §1.2.
describe('StepIndicator', () => {
  it('marks the current step with aria-current="step" and an sr-only "Step N of 6" prefix', () => {
    render(<StepIndicator currentStep={2} />)

    const current = screen.getByText('Address').closest('[aria-current="step"]')
    expect(current).not.toBeNull()
    expect(screen.getByText('Step 2 of 6')).toHaveClass('sr-only')
  })

  it('renders completed steps as real links back to that step', () => {
    render(<StepIndicator currentStep={3} />)

    const channelLink = screen.getByRole('link', { name: /channel & type/i })
    expect(channelLink).toHaveAttribute('href', '?step=1')
    const addressLink = screen.getByRole('link', { name: /address/i })
    expect(addressLink).toHaveAttribute('href', '?step=2')
  })

  it('renders upcoming steps as plain, non-focusable text (no jump-forward)', () => {
    render(<StepIndicator currentStep={2} />)

    expect(
      screen.queryByRole('link', { name: /details/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Details').tagName).not.toBe('A')
  })

  it('shows every one of the 6 step labels', () => {
    render(<StepIndicator currentStep={1} />)

    for (const label of [
      'Channel & type',
      'Address',
      'Details',
      'Description & features',
      'Photos',
      'Review',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the mobile "STEP N OF 6" eyebrow', () => {
    render(<StepIndicator currentStep={4} />)
    expect(screen.getByText('STEP 4 OF 6')).toBeInTheDocument()
  })
})
