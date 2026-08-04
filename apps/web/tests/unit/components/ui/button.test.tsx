import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'

/**
 * Base UI's `nativeButton` prop defaults to `true`. Every call site that
 * composes Button with `render={<Link .../>}` (site-header.tsx,
 * hero-section.tsx, for-agents-section.tsx, not-found.tsx) renders a
 * non-<button> element through that prop, which makes Base UI log
 * "A component that acts as a button expected a native <button>..." on
 * every render in dev. Button must infer `nativeButton={false}` whenever
 * `render` is supplied and the caller hasn't said otherwise.
 */
describe('Button', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a native <button> element when no render prop is given', () => {
    render(<Button>Click me</Button>)

    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button.tagName).toBe('BUTTON')
  })

  it('renders the given element via `render` with no Base UI nativeButton warning', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<Button render={<a href="/sign-up" />}>Get early access</Button>)

    // Base UI applies role="button" to a non-native element once
    // nativeButton is false (correctly, since it can no longer rely on
    // native button semantics) — the anchor is still found by its
    // accessible name, just under the button role rather than link.
    const anchor = screen.getByRole('button', { name: 'Get early access' })
    expect(anchor.tagName).toBe('A')
    expect(anchor).toHaveAttribute('href', '/sign-up')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('respects an explicit nativeButton override even when render is given', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <Button render={<button type="button" />} nativeButton>
        Explicit native
      </Button>,
    )

    expect(consoleError).not.toHaveBeenCalled()
  })
})
