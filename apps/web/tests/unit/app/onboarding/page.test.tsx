import { describe, expect, it, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

const getSessionUserMock = vi.fn()
vi.mock('@/lib/session', () => ({
  getSessionUser: () => getSessionUserMock(),
}))

/**
 * /onboarding — PRD §6.5 LST-1's role-choice screen. Gated identically to
 * /lister at this DB-backed tier: no session -> sign in; already
 * onboarded (owner/agent/admin) -> straight to /lister, since there is
 * nothing left to choose (M1-DESIGN-SPEC.md §2's opening paragraph).
 */
describe('/onboarding page', () => {
  beforeEach(() => {
    redirectMock.mockReset()
    getSessionUserMock.mockReset()
  })

  it('redirects to sign-in when there is no session', async () => {
    getSessionUserMock.mockResolvedValue(null)
    const { default: OnboardingPage } =
      await import('@/app/(account)/onboarding/page')

    await OnboardingPage()

    expect(redirectMock).toHaveBeenCalledWith('/sign-in?next=%2Fonboarding')
  })

  it.each(['owner', 'agent', 'admin'] as const)(
    'redirects an already-onboarded role %s straight to /lister',
    async (role) => {
      getSessionUserMock.mockResolvedValue({ user: { role } })
      const { default: OnboardingPage } =
        await import('@/app/(account)/onboarding/page')

      await OnboardingPage()

      expect(redirectMock).toHaveBeenCalledWith('/lister')
    },
  )

  it('renders the role-choice screen for role user without redirecting', async () => {
    getSessionUserMock.mockResolvedValue({ user: { role: 'user' } })
    const { default: OnboardingPage } =
      await import('@/app/(account)/onboarding/page')

    const result = await OnboardingPage()

    expect(redirectMock).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })
})
