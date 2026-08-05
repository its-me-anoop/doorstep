import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const becomeOwnerMock = vi.fn()
vi.mock('@/lib/onboarding-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/onboarding-client')
  >('@/lib/onboarding-client')
  return {
    ...actual,
    becomeOwner: (...args: unknown[]) => becomeOwnerMock(...args),
  }
})

const refreshSessionAfterUpgradeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/firebase-client', () => ({
  refreshSessionAfterUpgrade: () => refreshSessionAfterUpgradeMock(),
}))

import { OnboardingApiError } from '@/lib/onboarding-client'

import { RoleChoice } from '@/components/features/onboarding/role-choice'

describe('RoleChoice', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders both role rows with the spec copy, no third "join an agency" row', () => {
    render(<RoleChoice />)

    expect(
      screen.getByRole('heading', { name: /how would you like to list/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /i.m a private owner or landlord/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /i.m an agent/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/join an agency/i)).not.toBeInTheDocument()
  })

  it('selecting "private owner" calls becomeOwner, refreshes the session, then routes to /lister', async () => {
    becomeOwnerMock.mockResolvedValue(undefined)
    render(<RoleChoice />)

    fireEvent.click(
      screen.getByRole('button', { name: /i.m a private owner or landlord/i }),
    )

    await waitFor(() => expect(becomeOwnerMock).toHaveBeenCalled())
    await waitFor(() =>
      expect(refreshSessionAfterUpgradeMock).toHaveBeenCalled(),
    )
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/lister'))
    expect(refreshMock).toHaveBeenCalled()
  })

  it('still routes to /lister when refreshSessionAfterUpgrade throws (the normal no-live-Firebase-user case)', async () => {
    becomeOwnerMock.mockResolvedValue(undefined)
    refreshSessionAfterUpgradeMock.mockRejectedValueOnce(
      new Error('no live Firebase user'),
    )
    render(<RoleChoice />)

    fireEvent.click(
      screen.getByRole('button', { name: /i.m a private owner or landlord/i }),
    )

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/lister'))
  })

  it('shows a friendly error and does not navigate when becomeOwner fails', async () => {
    becomeOwnerMock.mockRejectedValue(
      new OnboardingApiError('internal_error', 'Something went wrong.'),
    )
    render(<RoleChoice />)

    fireEvent.click(
      screen.getByRole('button', { name: /i.m a private owner or landlord/i }),
    )

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('selecting "agent" routes straight to the agency creation form without calling becomeOwner', () => {
    render(<RoleChoice />)

    fireEvent.click(screen.getByRole('button', { name: /i.m an agent/i }))

    expect(pushMock).toHaveBeenCalledWith('/onboarding/agency')
    expect(becomeOwnerMock).not.toHaveBeenCalled()
  })
})
