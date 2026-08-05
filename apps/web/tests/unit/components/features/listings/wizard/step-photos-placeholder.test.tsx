import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StepPhotosPlaceholder } from '@/components/features/listings/wizard/step-photos-placeholder'

// M1-DESIGN-SPEC.md §3.5 — photo upload itself is a later phase; this
// pane must say so plainly rather than presenting broken controls.
describe('StepPhotosPlaceholder', () => {
  it('names all three spec subsections and is honest that upload is not available yet', () => {
    render(<StepPhotosPlaceholder />)

    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('Floorplan')).toBeInTheDocument()
    expect(screen.getByText('EPC certificate')).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('does not present any control that looks interactive but does nothing', () => {
    render(<StepPhotosPlaceholder />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
