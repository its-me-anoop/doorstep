import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CoverThumbnail } from '@/components/features/listings/dashboard/cover-thumbnail'

// M1-DESIGN-SPEC.md §4.2 point 1: "aspect-[4/3], w-24, blurhash
// placeholder until the real cover loads. Draft listings with zero
// photos yet show a flat --paper-200 tile with a tiny centred camera
// glyph."
describe('CoverThumbnail', () => {
  it('shows the flat no-photo tile with a camera glyph when there is no blurhash', () => {
    render(<CoverThumbnail blurhash={null} />)

    expect(screen.getByLabelText('No photo yet')).toBeInTheDocument()
  })

  // WCAG 4.1.2 (axe rule aria-prohibited-attr): `aria-label` is only
  // valid ARIA on an element whose role supports naming — a bare `<div>`
  // with no role does not, exactly like the has-a-blurhash branch below
  // already gets right with `role="img"`.
  it('gives the no-photo tile an img role so its aria-label is valid ARIA', () => {
    render(<CoverThumbnail blurhash={null} />)

    expect(
      screen.getByRole('img', { name: 'No photo yet' }),
    ).toBeInTheDocument()
  })

  it('renders a blurhash-derived colour tile when a blurhash is given', () => {
    render(<CoverThumbnail blurhash="LGF5?xYk^6#M@-5c,1J5@[or[Q6." />)

    expect(screen.queryByLabelText('No photo yet')).not.toBeInTheDocument()
    const tile = screen.getByTestId('cover-thumbnail')
    expect(tile.style.backgroundColor).toMatch(/^rgb\(/)
  })
})
