import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LocationSection } from '@/components/features/listings/detail/location-section'

// M2-DESIGN-SPEC.md §5.6 — display address (never addressLine1) + the
// reserved M3 map slot, reusing MediaPlaceholder verbatim.
describe('LocationSection', () => {
  it('renders the "Location." heading and the display address', () => {
    render(<LocationSection displayAddress="Oxford Road, Reading, RG30" />)
    expect(
      screen.getByRole('heading', { name: 'Location.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Oxford Road, Reading, RG30')).toBeInTheDocument()
  })

  it('renders the reserved map placeholder, hidden from assistive tech', () => {
    const { container } = render(
      <LocationSection displayAddress="Oxford Road, Reading, RG30" />,
    )
    const placeholder = container.querySelector('[aria-hidden="true"]')
    expect(placeholder).not.toBeNull()
  })
})
