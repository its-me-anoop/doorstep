import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ListerCard } from '@/components/features/listings/detail/lister-card'

// M2-DESIGN-SPEC.md §5.7 — agency name/logo or a Private Seller/Landlord
// badge, filling the same visual slot. Phone-reveal/enquiry CTA are M4
// reserved — this card renders neither in M2.
describe('ListerCard', () => {
  it('shows the agency name and listing town for an agency-listed property', () => {
    render(
      <ListerCard
        channel="sale"
        town="Reading"
        agency={{ id: 'agency-1', name: 'Barnes & Co', logoUrl: null }}
      />,
    )
    expect(screen.getByText('Barnes & Co')).toBeInTheDocument()
    expect(screen.getByText('Reading')).toBeInTheDocument()
  })

  it('renders the agency logo when one is set', () => {
    render(
      <ListerCard
        channel="sale"
        town="Reading"
        agency={{
          id: 'agency-1',
          name: 'Barnes & Co',
          logoUrl: 'https://example.com/logo.png',
        }}
      />,
    )
    expect(screen.getByRole('img', { name: 'Barnes & Co' })).toHaveAttribute(
      'src',
      'https://example.com/logo.png',
    )
  })

  it('does not render an image element when the agency has no logo', () => {
    render(
      <ListerCard
        channel="sale"
        town="Reading"
        agency={{ id: 'agency-1', name: 'Barnes & Co', logoUrl: null }}
      />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows a Private seller badge for a sale listing with no agency', () => {
    render(<ListerCard channel="sale" town="Reading" agency={null} />)
    expect(screen.getByText('Private seller')).toBeInTheDocument()
  })

  it('shows a Private landlord badge for a rent listing with no agency', () => {
    render(<ListerCard channel="rent" town="Reading" agency={null} />)
    expect(screen.getByText('Private landlord')).toBeInTheDocument()
  })

  it('never renders a "View agency profile" link (no public agency page ships in M2)', () => {
    render(
      <ListerCard
        channel="sale"
        town="Reading"
        agency={{ id: 'agency-1', name: 'Barnes & Co', logoUrl: null }}
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
