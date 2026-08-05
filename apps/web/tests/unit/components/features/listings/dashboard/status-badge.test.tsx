import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from '@/components/features/listings/dashboard/status-badge'

// M1-DESIGN-SPEC.md §1.3 — the seven lister-facing status badges (plus
// archived reusing Hidden's treatment).
describe('StatusBadge', () => {
  it('shows "Draft" for a draft listing', () => {
    render(<StatusBadge status="draft" channel="sale" />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('shows "Pending review" for a pending_review listing', () => {
    render(<StatusBadge status="pending_review" channel="sale" />)
    expect(screen.getByText('Pending review')).toBeInTheDocument()
  })

  it('shows "Rejected" with an alert icon for a rejected listing', () => {
    render(<StatusBadge status="rejected" channel="sale" />)
    const badge = screen.getByText('Rejected')
    expect(badge).toBeInTheDocument()
    expect(badge.parentElement?.querySelector('svg')).toBeInTheDocument()
  })

  it('shows "Published" for a published listing', () => {
    render(<StatusBadge status="published" channel="rent" />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('shows "Sold STC" for an under_offer sale listing (reuses getDisplayStatus)', () => {
    render(<StatusBadge status="under_offer" channel="sale" />)
    expect(screen.getByText('Sold STC')).toBeInTheDocument()
  })

  it('shows "Let Agreed" for an under_offer rent listing', () => {
    render(<StatusBadge status="under_offer" channel="rent" />)
    expect(screen.getByText('Let Agreed')).toBeInTheDocument()
  })

  it('shows "Sold" with a check icon for a completed sale listing', () => {
    render(<StatusBadge status="completed" channel="sale" />)
    const badge = screen.getByText('Sold')
    expect(badge).toBeInTheDocument()
    expect(badge.parentElement?.querySelector('svg')).toBeInTheDocument()
  })

  it('shows "Let" for a completed rent listing', () => {
    render(<StatusBadge status="completed" channel="rent" />)
    expect(screen.getByText('Let')).toBeInTheDocument()
  })

  it('shows "Hidden" for a hidden listing', () => {
    render(<StatusBadge status="hidden" channel="sale" />)
    expect(screen.getByText('Hidden')).toBeInTheDocument()
  })

  it('shows "Archived" for an archived listing, reusing the Hidden treatment', () => {
    render(<StatusBadge status="archived" channel="sale" />)
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('never shows colour as the only signal — every badge is a real text label', () => {
    render(<StatusBadge status="published" channel="sale" />)
    expect(screen.getByText('Published').textContent).toBe('Published')
  })
})
