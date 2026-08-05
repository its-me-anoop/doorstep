import { describe, expect, it, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

const getSessionUserMock = vi.fn()
vi.mock('@/lib/session', () => ({
  getSessionUser: () => getSessionUserMock(),
}))

describe('/onboarding/agency page', () => {
  beforeEach(() => {
    redirectMock.mockReset()
    getSessionUserMock.mockReset()
  })

  it('redirects to sign-in when there is no session', async () => {
    getSessionUserMock.mockResolvedValue(null)
    const { default: OnboardingAgencyPage } =
      await import('@/app/(account)/onboarding/agency/page')

    await OnboardingAgencyPage()

    expect(redirectMock).toHaveBeenCalledWith(
      '/sign-in?next=%2Fonboarding%2Fagency',
    )
  })

  it.each(['owner', 'agent', 'admin'] as const)(
    'redirects an already-onboarded role %s straight to /lister',
    async (role) => {
      getSessionUserMock.mockResolvedValue({
        user: { role, email: 'x@example.com' },
      })
      const { default: OnboardingAgencyPage } =
        await import('@/app/(account)/onboarding/agency/page')

      await OnboardingAgencyPage()

      expect(redirectMock).toHaveBeenCalledWith('/lister')
    },
  )

  it('renders the agency form for role user, passing the account email through', async () => {
    getSessionUserMock.mockResolvedValue({
      user: { role: 'user', email: 'sarah@example.com' },
    })
    const { default: OnboardingAgencyPage } =
      await import('@/app/(account)/onboarding/agency/page')

    const result = await OnboardingAgencyPage()

    expect(redirectMock).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).toContain('sarah@example.com')
  })
})
