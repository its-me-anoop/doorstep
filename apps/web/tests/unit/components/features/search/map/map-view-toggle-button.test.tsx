import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MapViewToggleButton } from '@/components/features/search/map/map-view-toggle-button'

// M3-DESIGN-SPEC.md §2 — the desktop sort/count row's compact toggle:
// "[ Map ]", relabelling to "[ List ]" while active, `aria-pressed`.
describe('MapViewToggleButton', () => {
  it('labels "Map" and is not pressed while viewing the list', () => {
    render(<MapViewToggleButton isMapView={false} onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Map' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('labels "List" and is pressed while viewing the map', () => {
    render(<MapViewToggleButton isMapView={true} onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'List' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onClick when activated', () => {
    const onClick = vi.fn()
    render(<MapViewToggleButton isMapView={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
