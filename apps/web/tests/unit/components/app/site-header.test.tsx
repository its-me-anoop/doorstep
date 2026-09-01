import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/for-sale',
}))

vi.mock('@/components/features/search/search-combobox', () => ({
  SearchCombobox: () => <div>combobox</div>,
}))

vi.mock('@/lib/session', () => ({
  getSessionUser: vi.fn().mockResolvedValue(null),
}))

import { SiteHeader } from '@/components/site-header'

describe('SiteHeader', () => {
  it('keeps Sign in on one line and does not clip the guest nav', async () => {
    render(await SiteHeader())

    const signIn = screen.getByRole('link', { name: 'Sign in' })
    expect(signIn.className).toContain('whitespace-nowrap')
    expect(signIn.className).toContain('h-11')
    expect(signIn.className).toContain('min-w-11')
    expect(
      screen.getByRole('button', { name: 'Get early access' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Doorstep' })).toBeInTheDocument()
  })
})
