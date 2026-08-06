import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/components/features/search/search-combobox', () => ({
  SearchCombobox: () => <div>combobox placeholder</div>,
}))

import { HeroSearchBox } from '@/components/features/landing/hero-search-box'

// M2-DESIGN-SPEC.md §2.1 — the hero's channel toggle + combobox + Search
// button, replacing the old CTA row.
describe('HeroSearchBox', () => {
  afterEach(() => {
    pushMock.mockClear()
  })

  it('defaults to the "For sale" channel', () => {
    render(<HeroSearchBox />)
    expect(screen.getByRole('button', { name: 'For sale' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('submitting with no text/suggestion navigates to the unrestricted tier for the selected channel', () => {
    render(<HeroSearchBox />)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(pushMock).toHaveBeenCalledWith('/for-sale')
  })

  it('switching to "To rent" then submitting navigates to /to-rent', () => {
    render(<HeroSearchBox />)
    fireEvent.click(screen.getByRole('button', { name: 'To rent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(pushMock).toHaveBeenCalledWith('/to-rent')
  })
})
