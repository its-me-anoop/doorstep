import { inspect } from 'node:util'

import { describe, expect, it, vi, beforeEach } from 'vitest'

// Base UI's Button wraps its rendered element in structures that contain
// circular references (ref forwarding), so JSON.stringify throws on the
// resolved tree — node:util's inspect handles cycles gracefully instead.
function serialise(node: unknown): string {
  return inspect(node, { depth: 12, breakLength: Infinity })
}

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const getSessionUserMock = vi.fn()
vi.mock('@/lib/session', () => ({
  getSessionUser: () => getSessionUserMock(),
}))

/**
 * The account page's M1-DESIGN-SPEC.md §2.0 lister entry point: role
 * `user` gets a wayfinding link to /onboarding; anyone already onboarded
 * (owner/agent/admin) gets a link straight to /lister instead, with no
 * re-onboarding prompt.
 */
describe('AccountPage lister entry point', () => {
  beforeEach(() => {
    getSessionUserMock.mockReset()
  })

  it('shows the "start listing" link to /onboarding for role user', async () => {
    getSessionUserMock.mockResolvedValue({
      user: {
        id: 'u1',
        displayName: 'Sarah Cole',
        email: 'sarah@example.com',
        role: 'user',
      },
    })
    const { default: AccountPage } =
      await import('@/app/(account)/account/page')

    const result = await AccountPage()

    const serialised = serialise(result)
    expect(serialised).toContain('Start listing a property')
    expect(serialised).toContain('/onboarding')
    expect(serialised).not.toContain('Go to your listings')
  })

  it.each(['owner', 'agent', 'admin'] as const)(
    'shows the "go to your listings" link to /lister for role %s',
    async (role) => {
      getSessionUserMock.mockResolvedValue({
        user: {
          id: 'u1',
          displayName: 'David Price',
          email: 'david@example.com',
          role,
        },
      })
      const { default: AccountPage } =
        await import('@/app/(account)/account/page')

      const result = await AccountPage()

      const serialised = serialise(result)
      expect(serialised).toContain('Go to your listings')
      expect(serialised).toContain('/lister')
      expect(serialised).not.toContain('Start listing a property')
    },
  )
})
