import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from '@/components/features/search/empty-state'

// M2-DESIGN-SPEC.md §3.8 — teach the way out, never "No results found."
describe('EmptyState', () => {
  it('shows the spec heading, not a generic "No results" message', () => {
    render(
      <EmptyState unfilteredHref="/for-sale/reading" areaLabel="Reading" />,
    )
    expect(
      screen.getByText('Nothing matches those filters yet.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/No results found/)).not.toBeInTheDocument()
  })

  it('links to the unfiltered area URL with the area name in the link text', () => {
    render(
      <EmptyState
        unfilteredHref="/for-sale/reading"
        areaLabel="Reading"
        channel="sale"
      />,
    )
    const link = screen.getByRole('link', {
      name: 'see all homes for sale in Reading',
    })
    expect(link).toHaveAttribute('href', '/for-sale/reading')
  })

  it('uses "to rent in" copy for the rent channel', () => {
    render(
      <EmptyState
        unfilteredHref="/to-rent/reading"
        areaLabel="Reading"
        channel="rent"
      />,
    )
    expect(
      screen.getByRole('link', { name: 'see all homes to rent in Reading' }),
    ).toBeInTheDocument()
  })
})
