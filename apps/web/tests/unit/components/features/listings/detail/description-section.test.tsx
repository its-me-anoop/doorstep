import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DescriptionSection } from '@/components/features/listings/detail/description-section'

// M2-DESIGN-SPEC.md §5.5 — description with preserved line breaks
// (whitespace-pre-line, never dangerouslySetInnerHTML) + feature chips
// reusing the wizard's inert-content chip, not the filter chip's clay
// tint.
describe('DescriptionSection', () => {
  it('renders the "About this home." heading', () => {
    render(<DescriptionSection description="A lovely home." features={[]} />)
    expect(
      screen.getByRole('heading', { name: 'About this home.' }),
    ).toBeInTheDocument()
  })

  it('renders the description as plain text with preserved line breaks (no HTML injection)', () => {
    const { container } = render(
      <DescriptionSection
        description={'First paragraph.\n\nSecond paragraph.'}
        features={[]}
      />,
    )
    const paragraph = screen.getByText(/First paragraph\./)
    expect(paragraph).toHaveClass('whitespace-pre-line')
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders each feature as a chip', () => {
    render(
      <DescriptionSection
        description="A home."
        features={['Garden', 'Garage']}
      />,
    )
    expect(screen.getByText('Garden')).toBeInTheDocument()
    expect(screen.getByText('Garage')).toBeInTheDocument()
  })

  it('renders no chip row at all when there are no features', () => {
    const { container } = render(
      <DescriptionSection description="A home." features={[]} />,
    )
    expect(
      container.querySelectorAll('[data-testid="feature-chip"]'),
    ).toHaveLength(0)
  })
})
