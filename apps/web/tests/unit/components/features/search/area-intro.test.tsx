import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AreaIntro } from '@/components/features/search/area-intro'
import type { AreaDefinition } from '@/lib/areas'
import type { PublicSearchHit } from '@/services/search/search-listings'

const area: AreaDefinition = {
  slug: 'reading',
  label: 'Reading',
  match: { town: 'Reading' },
  centre: { lat: 51.4543, lng: -0.9781 },
  radiusMiles: 3,
  intro: "Reading's town centre puts everything within a short walk.",
}

function hit(overrides: Partial<PublicSearchHit> = {}): PublicSearchHit {
  return {
    id: 'pr_1',
    slug: 'a-slug',
    channel: 'sale',
    title: 'A home',
    displayAddress: 'Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG1',
    propertyType: 'flat',
    bedrooms: 2,
    bathrooms: 1,
    price: 250000,
    priceQualifier: 'fixed',
    displayStatus: 'published',
    furnished: null,
    availableFrom: null,
    newHome: false,
    coverImageUrl: null,
    imageCount: 0,
    agency: null,
    publishedAt: 0,
    geo: { lat: 51.45, lng: -0.98 },
    ...overrides,
  }
}

// M2-DESIGN-SPEC.md §4.1 — intro copy + newest-listings strip + CTA link,
// rendered only on the canonical (zero-filter) area URL.
describe('AreaIntro', () => {
  it("renders the area's own intro paragraph", () => {
    render(
      <AreaIntro
        area={area}
        channel="sale"
        newest={[]}
        totalCount={0}
        now={1000}
      />,
    )
    expect(
      screen.getByText(
        "Reading's town centre puts everything within a short walk.",
      ),
    ).toBeInTheDocument()
  })

  it('renders the "Newest in {area}" strip when there are listings', () => {
    render(
      <AreaIntro
        area={area}
        channel="sale"
        newest={[hit({ id: 'pr_1' }), hit({ id: 'pr_2', slug: 'b' })]}
        totalCount={12}
        now={1000}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'Newest in Reading' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Oxford Road, Reading')).toHaveLength(2)
  })

  it('omits the newest-listings heading entirely when there are none', () => {
    render(
      <AreaIntro
        area={area}
        channel="sale"
        newest={[]}
        totalCount={0}
        now={1000}
      />,
    )
    expect(
      screen.queryByRole('heading', { name: /Newest in/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the CTA link with the live count, channel copy and area label', () => {
    render(
      <AreaIntro
        area={area}
        channel="sale"
        newest={[]}
        totalCount={248}
        now={1000}
      />,
    )
    const link = screen.getByRole('link', {
      name: /Browse all 248 homes for sale in Reading/,
    })
    expect(link).toHaveAttribute('href', '#listings')
  })

  it('uses "to rent in" copy for the rent channel', () => {
    render(
      <AreaIntro
        area={area}
        channel="rent"
        newest={[]}
        totalCount={5}
        now={1000}
      />,
    )
    expect(
      screen.getByRole('link', {
        name: /Browse all 5 homes to rent in Reading/,
      }),
    ).toBeInTheDocument()
  })
})
