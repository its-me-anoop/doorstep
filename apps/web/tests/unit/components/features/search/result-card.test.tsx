import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ResultCard } from '@/components/features/search/result-card'
import type { PublicSearchHit } from '@/services/search/search-listings'

const NOW_SECONDS = Math.floor(Date.parse('2026-08-06T12:00:00Z') / 1000)
const EIGHT_DAYS_AGO = NOW_SECONDS - 8 * 24 * 60 * 60
const TWO_DAYS_AGO = NOW_SECONDS - 2 * 24 * 60 * 60

function baseHit(overrides: Partial<PublicSearchHit> = {}): PublicSearchHit {
  return {
    id: 'pr_1',
    slug: '3-bed-semi-detached-house-rg30',
    channel: 'sale',
    title: '3 bed semi-detached house',
    displayAddress: 'Oxford Road, Reading, RG30',
    town: 'Reading',
    outcode: 'RG30',
    propertyType: 'semi_detached',
    bedrooms: 3,
    bathrooms: 1,
    price: 350000,
    priceQualifier: 'guide_price',
    displayStatus: 'published',
    furnished: null,
    availableFrom: null,
    newHome: false,
    coverImageUrl: 'https://cdn.example.com/cover.webp',
    imageCount: 6,
    agency: { id: 'ag_1', name: 'Barnes & Co', logoUrl: null },
    publishedAt: EIGHT_DAYS_AGO,
    geo: { lat: 51.45, lng: -0.98 },
    ...overrides,
  }
}

// M2-DESIGN-SPEC.md §1.8 — result card anatomy.
describe('ResultCard', () => {
  it('links the whole card to the property detail route', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute(
      'href',
      '/property/3-bed-semi-detached-house-rg30',
    )
  })

  it('shows the price line via formatPrice, including the qualifier', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    expect(screen.getByText('Guide price £350,000')).toBeInTheDocument()
  })

  it('shows a rent price with the pcm suffix', () => {
    render(
      <ResultCard
        hit={baseHit({
          channel: 'rent',
          price: 1300,
          priceQualifier: 'fixed',
        })}
        now={NOW_SECONDS}
      />,
    )
    expect(screen.getByText('£1,300 pcm')).toBeInTheDocument()
  })

  it('shows the display address, never a raw address line', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    expect(screen.getByText('Oxford Road, Reading, RG30')).toBeInTheDocument()
  })

  it('shows beds, baths and property type on one middot-separated line', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    expect(
      screen.getByText('3 beds · 1 bath · Semi-detached house'),
    ).toBeInTheDocument()
  })

  it('singularises "1 bed" and "1 bath"', () => {
    render(
      <ResultCard
        hit={baseHit({ bedrooms: 1, bathrooms: 1 })}
        now={NOW_SECONDS}
      />,
    )
    expect(
      screen.getByText('1 bed · 1 bath · Semi-detached house'),
    ).toBeInTheDocument()
  })

  it('shows the agency name as plain byline text when agency-listed', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    expect(screen.getByText('Barnes & Co')).toBeInTheDocument()
    expect(screen.queryByText('Private seller')).not.toBeInTheDocument()
  })

  it('shows a "Private seller" badge for a private sale listing with no agency', () => {
    render(<ResultCard hit={baseHit({ agency: null })} now={NOW_SECONDS} />)
    expect(screen.getByText('Private seller')).toBeInTheDocument()
  })

  it('shows a "Private landlord" badge for a private rent listing with no agency', () => {
    render(
      <ResultCard
        hit={baseHit({ channel: 'rent', agency: null })}
        now={NOW_SECONDS}
      />,
    )
    expect(screen.getByText('Private landlord')).toBeInTheDocument()
  })

  it('shows "New this week" when published within the last 7 days and not under offer', () => {
    render(
      <ResultCard
        hit={baseHit({ publishedAt: TWO_DAYS_AGO })}
        now={NOW_SECONDS}
      />,
    )
    expect(screen.getByText('New this week')).toBeInTheDocument()
  })

  it('does not show "New this week" once published more than 7 days ago', () => {
    render(
      <ResultCard
        hit={baseHit({ publishedAt: EIGHT_DAYS_AGO })}
        now={NOW_SECONDS}
      />,
    )
    expect(screen.queryByText('New this week')).not.toBeInTheDocument()
  })

  it('shows the under-offer status badge instead of "New this week", even for a recent listing', () => {
    render(
      <ResultCard
        hit={baseHit({
          displayStatus: 'Sold STC',
          publishedAt: TWO_DAYS_AGO,
        })}
        now={NOW_SECONDS}
      />,
    )
    expect(screen.getByText('Sold STC')).toBeInTheDocument()
    expect(screen.queryByText('New this week')).not.toBeInTheDocument()
  })

  it('shows "Let Agreed" for a rent under-offer listing', () => {
    render(
      <ResultCard
        hit={baseHit({ channel: 'rent', displayStatus: 'Let Agreed' })}
        now={NOW_SECONDS}
      />,
    )
    expect(screen.getByText('Let Agreed')).toBeInTheDocument()
  })

  it('renders no freshness/status badge for a default published, non-recent listing', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    expect(screen.queryByText('New this week')).not.toBeInTheDocument()
    expect(screen.queryByText('Sold STC')).not.toBeInTheDocument()
    expect(screen.queryByText('Let Agreed')).not.toBeInTheDocument()
  })

  it('renders the cover photo image when a coverImageUrl is present', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    const img = screen.getByRole('img', { name: /3 bed semi-detached house/i })
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/cover.webp')
  })

  it('renders a flat placeholder tile with no img element when there is no cover photo', () => {
    render(
      <ResultCard hit={baseHit({ coverImageUrl: null })} now={NOW_SECONDS} />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('reserves an empty, non-interactive 44x44 save-heart slot (M4)', () => {
    render(<ResultCard hit={baseHit()} now={NOW_SECONDS} />)
    const slot = screen.getByTestId('card-action-slot')
    expect(slot).toHaveAttribute('aria-hidden', 'true')
    expect(slot).toBeEmptyDOMElement()
  })
})
