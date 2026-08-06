import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))
const pushMock = vi.fn()

afterEach(() => {
  pushMock.mockClear()
})

import { ChannelToggle } from '@/components/features/search/channel-toggle'
import type { SearchUrlState } from '@/lib/search-url'

// M2-DESIGN-SPEC.md §1.2/§3.2 — the reset rule: switching channel
// preserves location/beds/type/sort, resets price bounds and page, and
// drops furnished/availableFrom entirely.
describe('ChannelToggle', () => {
  it('renders "For sale" and "To rent" as two buttons', () => {
    render(<ChannelToggle channel="sale" state={{}} basePath="/for-sale" />)
    expect(screen.getByRole('button', { name: 'For sale' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'To rent' })).toBeInTheDocument()
  })

  it('marks the active channel with aria-pressed', () => {
    render(<ChannelToggle channel="sale" state={{}} basePath="/for-sale" />)
    expect(screen.getByRole('button', { name: 'For sale' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'To rent' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('navigates to /to-rent preserving location, beds, type and sort, dropping price/page/furnished/availableFrom', async () => {
    const state: SearchUrlState = {
      lat: 51.454,
      lng: -0.9788,
      radius: 5,
      label: 'RG1 8BT',
      minBeds: 2,
      maxBeds: 4,
      type: ['flat'],
      sort: 'price_asc',
      minPrice: 250000,
      maxPrice: 400000,
      page: 3,
      furnished: ['furnished'],
      availableFrom: '2026-09-01',
    }
    render(
      <ChannelToggle
        channel="sale"
        state={state}
        basePath="/for-sale/search"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'To rent' }))

    expect(pushMock).toHaveBeenCalledTimes(1)
    const href = pushMock.mock.calls[0][0] as string
    expect(href.startsWith('/to-rent/search?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('lat')).toBe('51.454')
    expect(params.get('lng')).toBe('-0.9788')
    expect(params.get('radius')).toBe('5')
    expect(params.get('label')).toBe('RG1 8BT')
    expect(params.get('minBeds')).toBe('2')
    expect(params.get('maxBeds')).toBe('4')
    expect(params.get('type')).toBe('flat')
    expect(params.get('sort')).toBe('price_asc')
    expect(params.has('minPrice')).toBe(false)
    expect(params.has('maxPrice')).toBe(false)
    expect(params.has('page')).toBe(false)
    expect(params.has('furnished')).toBe(false)
    expect(params.has('availableFrom')).toBe(false)
  })

  it('does nothing when clicking the already-active channel', async () => {
    render(<ChannelToggle channel="sale" state={{}} basePath="/for-sale" />)
    fireEvent.click(screen.getByRole('button', { name: 'For sale' }))
    expect(pushMock).not.toHaveBeenCalled()
  })
})
