import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBanner } from '@/components/features/listings/detail/status-banner'

// M2-DESIGN-SPEC.md §5.2 — rendered only for under_offer; a plain
// published listing needs no banner at all (the common case).
describe('StatusBanner', () => {
  it('renders nothing for a published listing', () => {
    const { container } = render(
      <StatusBanner displayStatus="published" channel="sale" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the Sold STC banner with sale copy', () => {
    render(<StatusBanner displayStatus="Sold STC" channel="sale" />)
    expect(screen.getByText('Sold STC')).toBeInTheDocument()
    expect(
      screen.getByText(
        /This home has an offer accepted and may not be available\./,
      ),
    ).toBeInTheDocument()
  })

  it('shows the Let Agreed banner with rent copy', () => {
    render(<StatusBanner displayStatus="Let Agreed" channel="rent" />)
    expect(screen.getByText('Let Agreed')).toBeInTheDocument()
    expect(
      screen.getByText(/This home is under offer and may not be available\./),
    ).toBeInTheDocument()
  })
})
