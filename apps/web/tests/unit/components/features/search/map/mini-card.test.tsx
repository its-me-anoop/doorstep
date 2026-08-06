import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MiniCard } from '@/components/features/search/map/mini-card'
import type { PublicSearchHit } from '@/services/search/search-listings'

function hit(overrides: Partial<PublicSearchHit> = {}): PublicSearchHit {
  return {
    id: 'pr_1',
    slug: 'oxford-road-flat',
    channel: 'sale',
    title: 'A flat on Oxford Road',
    displayAddress: 'Oxford Road, Reading, RG30',
    town: 'Reading',
    outcode: 'RG30',
    propertyType: 'semi_detached',
    bedrooms: 3,
    bathrooms: 2,
    price: 350_000,
    priceQualifier: 'guide_price',
    displayStatus: 'published',
    furnished: null,
    availableFrom: null,
    newHome: false,
    coverImageUrl: 'https://cdn.example.com/cover.jpg',
    imageCount: 4,
    agency: { id: 'ag_1', name: 'Acme Agents', logoUrl: null },
    publishedAt: 0,
    geo: { lat: 51.454, lng: -0.9788 },
    ...overrides,
  }
}

// M3-DESIGN-SPEC.md §1.4 — the mini card. A condensed ResultCard, not a
// new invented layout: same fields (price, address, beds/type), minus
// the agency/private byline (a deliberate density cut) and minus baths
// (the spec's own worked example omits it: "3 beds · Semi-detached
// house").
describe('MiniCard', () => {
  it('shows price, address and a beds/type line (no baths)', () => {
    render(<MiniCard hit={hit()} onClose={vi.fn()} />)
    expect(screen.getByText('Guide price £350,000')).toBeInTheDocument()
    expect(screen.getByText('Oxford Road, Reading, RG30')).toBeInTheDocument()
    expect(screen.getByText('3 beds · Semi-detached house')).toBeInTheDocument()
  })

  it('never shows an agency name or a private-seller badge — the one field trimmed versus the full card', () => {
    render(<MiniCard hit={hit()} onClose={vi.fn()} />)
    expect(screen.queryByText('Acme Agents')).not.toBeInTheDocument()

    render(<MiniCard hit={hit({ agency: null })} onClose={vi.fn()} />)
    expect(screen.queryByText('Private seller')).not.toBeInTheDocument()
  })

  it('links the thumb+text block to the property detail page', () => {
    render(<MiniCard hit={hit({ slug: 'my-slug' })} onClose={vi.fn()} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/property/my-slug',
    )
  })

  // §1.4's stated DOM-shape requirement, to avoid a nested-interactive-
  // element bug: the close [x] is a sibling <button>, never nested
  // inside the <a>.
  it('renders the close button as a sibling of the link, never nested inside it', () => {
    const { container } = render(<MiniCard hit={hit()} onClose={vi.fn()} />)
    const link = container.querySelector('a')
    expect(link?.querySelector('button')).toBeNull()
    expect(container.querySelector('.mini-card > button')).not.toBeNull()
    expect(container.querySelector('.mini-card > a')).not.toBeNull()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<MiniCard hit={hit()} onClose={onClose} />)
    screen.getByRole('button', { name: 'Close' }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exposes price + address as the group accessible name', () => {
    render(<MiniCard hit={hit()} onClose={vi.fn()} />)
    expect(
      screen.getByRole('group', {
        name: 'Guide price £350,000, Oxford Road, Reading, RG30',
      }),
    ).toBeInTheDocument()
  })

  it('renders a flat placeholder tile with no <img> when there is no cover image', () => {
    const { container } = render(
      <MiniCard hit={hit({ coverImageUrl: null })} onClose={vi.fn()} />,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})
