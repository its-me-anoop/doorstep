import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OutagePanel } from '@/components/features/search/outage-panel'

// M2-DESIGN-SPEC.md §1.10 point 4 / §3.9 — the search_unavailable 503
// state. Renders in the grid's slot only; not a full-page takeover.
describe('OutagePanel', () => {
  it('shows the spec-exact heading and body copy', () => {
    render(<OutagePanel onRetry={vi.fn()} />)
    expect(screen.getByText('Search’s taking a breather.')).toBeInTheDocument()
    expect(screen.getByText(/Something.s wrong on our end/)).toBeInTheDocument()
    expect(screen.getByText(/Everything else on Doorstep/)).toBeInTheDocument()
  })

  it('calls onRetry when the Try again button is clicked', () => {
    const onRetry = vi.fn()
    render(<OutagePanel onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('is not styled as a destructive/error alert (no role="alert")', () => {
    render(<OutagePanel onRetry={vi.fn()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
