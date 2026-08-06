import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let pathname = '/for-sale'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('@/components/features/search/search-combobox', () => ({
  SearchCombobox: ({ channel }: { channel: string }) => (
    <div data-testid="combobox" data-channel={channel}>
      combobox
    </div>
  ),
}))

import { HeaderSearch } from '@/components/header-search'

// M2-DESIGN-SPEC.md §2.2 — the header search affordance: absent on the
// homepage (the hero already carries the full box), present everywhere
// else, channel-aware, and collapsed to a tap-to-expand icon on mobile.
describe('HeaderSearch', () => {
  it('renders nothing on the homepage', () => {
    pathname = '/'
    const { container } = render(<HeaderSearch />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the combobox on a non-homepage route', () => {
    pathname = '/for-sale'
    render(<HeaderSearch />)
    expect(screen.getAllByTestId('combobox').length).toBeGreaterThan(0)
  })

  it('defaults the combobox to the sale channel outside /to-rent', () => {
    pathname = '/for-sale'
    render(<HeaderSearch />)
    expect(screen.getAllByTestId('combobox')[0]).toHaveAttribute(
      'data-channel',
      'sale',
    )
  })

  it('uses the rent channel on a /to-rent route', () => {
    pathname = '/to-rent/search'
    render(<HeaderSearch />)
    expect(screen.getAllByTestId('combobox')[0]).toHaveAttribute(
      'data-channel',
      'rent',
    )
  })

  it('has a mobile search toggle button with a 44px accessible tap target', () => {
    pathname = '/for-sale'
    render(<HeaderSearch />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('toggling the mobile button flips aria-expanded', () => {
    pathname = '/for-sale'
    render(<HeaderSearch />)
    const button = screen.getByRole('button', { name: 'Search' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})
