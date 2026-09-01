import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MobileMapTogglePill } from '@/components/features/search/map/mobile-map-toggle-pill'

// M3-DESIGN-SPEC.md §3.1 — the list-side "Map" pill. Lives in the
// results toolbar (in document flow) so it cannot cover heading or
// empty-state copy.
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

  it('is in document flow, not a fixed overlay', () => {
    render(<MobileMapTogglePill onClick={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Map' })
    expect(button.className).toContain('inline-flex')
    expect(button.className).not.toContain('fixed')
  })
})
