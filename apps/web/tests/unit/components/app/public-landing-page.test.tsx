import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Page from '@/app/(public)/page'

describe('(public)/page (landing)', () => {
  it('renders the spec hero heading as the page h1', async () => {
    render(await Page())

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A property site that actually knows Reading.',
      }),
    ).toBeInTheDocument()
  })
})
