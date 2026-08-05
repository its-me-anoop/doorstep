import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { UserRole } from '@/domain/enums'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

const getSessionUserMock = vi.fn()
vi.mock('@/lib/session', () => ({
  getSessionUser: () => getSessionUserMock(),
}))

/**
 * The (lister) layout is the real, DB-backed half of PRD §8.4's two-tier
 * /lister gate (see lib/decide-gate.ts's "TWO-TIER GATING" doc comment
 * for the proxy-tier half, which only checks session presence). This
 * suite exercises the layout function directly rather than rendering it
 * — a shallow tree walk on the resolved element is enough to prove the
 * redirect decision and that children are actually threaded through.
 */
describe('(lister) layout', () => {
  beforeEach(() => {
    redirectMock.mockReset()
    getSessionUserMock.mockReset()
  })

  it('redirects to sign-in when there is no session at all', async () => {
    getSessionUserMock.mockResolvedValue(null)
    const { default: ListerLayout } = await import('@/app/(lister)/layout')

    await ListerLayout({ children: null })

    expect(redirectMock).toHaveBeenCalledWith('/sign-in?next=%2Flister')
  })

  it('redirects role user on to /onboarding — they have not chosen a lister role yet', async () => {
    getSessionUserMock.mockResolvedValue({ user: { role: 'user' } })
    const { default: ListerLayout } = await import('@/app/(lister)/layout')

    await ListerLayout({ children: null })

    expect(redirectMock).toHaveBeenCalledWith('/onboarding')
  })

  it.each(['owner', 'agent', 'admin'] as const)(
    'renders children without redirecting for role %s',
    async (role: UserRole) => {
      getSessionUserMock.mockResolvedValue({ user: { role } })
      const { default: ListerLayout } = await import('@/app/(lister)/layout')

      const result = await ListerLayout({ children: 'LISTER_CHILD_MARKER' })

      expect(redirectMock).not.toHaveBeenCalled()
      expect(JSON.stringify(result)).toContain('LISTER_CHILD_MARKER')
    },
  )
})
