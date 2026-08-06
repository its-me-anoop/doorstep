import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  MapEmptyMessage,
  MapOverlay,
} from '@/components/features/search/map/map-overlay'

// M3-DESIGN-SPEC.md §1.8 — the map's own empty/degraded copy, distinct
// from M2's filter-driven EmptyState/OutagePanel: "no results in the
// current viewport" is a different situation from "no results match
// your filters," and a tile-CDN outage is a different failure domain
// again from a Meilisearch outage.
describe('MapEmptyMessage', () => {
  it('teaches the way out without implying anything is broken', () => {
    render(
      <MapEmptyMessage
        unfilteredHref="/for-sale"
        areaLabel="Reading & the Thames Valley"
        channel="sale"
      />,
    )
    expect(screen.getByText('Nothing in view right now.')).toBeInTheDocument()
    const link = screen.getByRole('link', {
      name: /see all homes for sale in Reading & the Thames Valley/,
    })
    expect(link).toHaveAttribute('href', '/for-sale')
  })

  it('uses "to rent in" copy for the rent channel', () => {
    render(
      <MapEmptyMessage
        unfilteredHref="/to-rent"
        areaLabel="Reading"
        channel="rent"
      />,
    )
    expect(
      screen.getByRole('link', { name: /see all homes to rent in Reading/ }),
    ).toBeInTheDocument()
  })
})

describe('MapOverlay', () => {
  it('renders the empty variant inside the card container', () => {
    const { container } = render(
      <MapOverlay
        variant={{
          kind: 'empty',
          unfilteredHref: '/for-sale',
          areaLabel: 'Reading',
          channel: 'sale',
        }}
      />,
    )
    expect(screen.getByText('Nothing in view right now.')).toBeInTheDocument()
    expect(container.querySelector('.bg-card')).not.toBeNull()
  })

  // §1.8 point 2 — reuses M2's own outage opening line verbatim, with
  // map-specific body copy ("can't load pins," not "can't run this
  // search").
  it('renders the search-unavailable outage variant and wires the retry button', () => {
    const onRetry = vi.fn()
    render(<MapOverlay variant={{ kind: 'outage', onRetry }} />)
    expect(screen.getByText('Search’s taking a breather.')).toBeInTheDocument()
    expect(
      screen.getByText(/We can’t load pins right now — it isn’t you\./),
    ).toBeInTheDocument()
    screen.getByRole('button', { name: 'Try again' }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // §1.8 point 3 — the map-specific tile-CDN failure, with a genuine,
  // keyboard-reachable route back to content.
  it('renders the tiles-failed variant with a real link back to list view', () => {
    render(
      <MapOverlay variant={{ kind: 'tiles-failed', listHref: '/for-sale' }} />,
    )
    expect(
      screen.getByText('Map tiles aren’t loading right now.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'View as a list' }),
    ).toHaveAttribute('href', '/for-sale')
  })
})
