import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MobileMapTogglePill } from '@/components/features/search/map/mobile-map-toggle-pill'

// M3-DESIGN-SPEC.md §3.1 — the single floating "Map" pill, shown only
// while viewing the list on mobile (the map's own "List (N)" pill,
// map-view.tsx, is the other half of this one-destination-at-a-time
// control).
describe('MobileMapTogglePill', () => {
  it('renders a real, labelled button', () => {
    render(<MobileMapTogglePill onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument()
  })

  it('calls onClick when activated', () => {
    const onClick = vi.fn()
    render(<MobileMapTogglePill onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
