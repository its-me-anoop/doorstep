import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

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
