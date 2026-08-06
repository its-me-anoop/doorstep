import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from '@/components/features/search/pagination'

// M2-DESIGN-SPEC.md §3.7 — real <a href> page links, aria-current on the
// current page, Prev/Next absent at the ends.
describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination
        page={1}
        totalPages={1}
        hrefForPage={() => '#'}
        onSelect={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each page as a real link with the given href', () => {
    render(
      <Pagination
        page={2}
        totalPages={3}
        hrefForPage={(p) => `/for-sale?page=${p}`}
        onSelect={vi.fn()}
      />,
    )
    const link = screen.getByRole('link', { name: '1' })
    expect(link).toHaveAttribute('href', '/for-sale?page=1')
  })

  it('marks the current page with aria-current and no link', () => {
    render(
      <Pagination
        page={2}
        totalPages={3}
        hrefForPage={(p) => `/for-sale?page=${p}`}
        onSelect={vi.fn()}
      />,
    )
    const current = screen.getByText('2')
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current.tagName).not.toBe('A')
  })

  it('omits Prev on page 1 and Next on the last page', () => {
    const { rerender } = render(
      <Pagination
        page={1}
        totalPages={3}
        hrefForPage={(p) => `?page=${p}`}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.queryByRole('link', { name: 'Prev' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Next' })).toBeInTheDocument()

    rerender(
      <Pagination
        page={3}
        totalPages={3}
        hrefForPage={(p) => `?page=${p}`}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('link', { name: 'Prev' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('calls onSelect with the target page and prevents default navigation on click', () => {
    const onSelect = vi.fn()
    render(
      <Pagination
        page={1}
        totalPages={3}
        hrefForPage={(p) => `/for-sale?page=${p}`}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('link', { name: '2' }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('renders an ellipsis for a long result set', () => {
    render(
      <Pagination
        page={1}
        totalPages={10}
        hrefForPage={(p) => `?page=${p}`}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('…')).toBeInTheDocument()
  })
})
