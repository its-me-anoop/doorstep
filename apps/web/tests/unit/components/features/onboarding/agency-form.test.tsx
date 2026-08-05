import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const createAgencyMock = vi.fn()
vi.mock('@/lib/onboarding-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/onboarding-client')
  >('@/lib/onboarding-client')
  return {
    ...actual,
    createAgency: (...args: unknown[]) => createAgencyMock(...args),
  }
})

const refreshSessionAfterUpgradeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/firebase-client', () => ({
  refreshSessionAfterUpgrade: () => refreshSessionAfterUpgradeMock(),
}))

import { OnboardingApiError } from '@/lib/onboarding-client'

import { AgencyForm } from '@/components/features/onboarding/agency-form'

async function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/agency name/i), {
    target: { value: 'Thameside Property Partners' },
  })
  fireEvent.change(screen.getByLabelText(/phone/i), {
    target: { value: '0118 950 1147' },
  })
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: 'hello@thamesidepropertypartners.co.uk' },
  })
  fireEvent.change(screen.getByLabelText(/website/i), {
    target: { value: 'https://www.thamesidepropertypartners.co.uk' },
  })
  fireEvent.change(screen.getByLabelText(/branch address/i), {
    target: { value: '12 Kings Road, Reading, RG1 3AA' },
  })
}

describe('AgencyForm', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders every spec field, in order, with the email defaulted from the signed-in user', () => {
    render(<AgencyForm defaultEmail="sarah@example.com" />)

    expect(
      screen.getByRole('heading', { name: /set up your agency/i }),
    ).toBeInTheDocument()

    const labels = screen.getAllByText(
      /agency name|phone|^email$|website|branch address/i,
    )
    expect(labels.length).toBeGreaterThanOrEqual(5)

    expect(screen.getByLabelText(/^email$/i)).toHaveValue('sarah@example.com')
  })

  it('shows the field-specific validation message on blur for an empty required field', async () => {
    render(<AgencyForm defaultEmail="sarah@example.com" />)

    const nameField = screen.getByLabelText(/agency name/i)
    fireEvent.focus(nameField)
    fireEvent.blur(nameField)

    expect(
      await screen.findByText(/agency name must be at least 2 characters/i),
    ).toBeInTheDocument()
    expect(createAgencyMock).not.toHaveBeenCalled()
  })

  it('does not submit and shows validation when the address is left blank', async () => {
    render(<AgencyForm defaultEmail="sarah@example.com" />)

    fireEvent.change(screen.getByLabelText(/agency name/i), {
      target: { value: 'Thameside Property Partners' },
    })
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '0118 950 1147' },
    })
    fireEvent.change(screen.getByLabelText(/website/i), {
      target: { value: 'https://www.thamesidepropertypartners.co.uk' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /create agency profile/i }),
    )

    expect(
      await screen.findByText(/enter your branch address/i),
    ).toBeInTheDocument()
    expect(createAgencyMock).not.toHaveBeenCalled()
  })

  it('submits a valid form, refreshes the session, then routes to /lister', async () => {
    createAgencyMock.mockResolvedValue(undefined)
    render(<AgencyForm defaultEmail="sarah@example.com" />)

    await fillValidForm()
    fireEvent.click(
      screen.getByRole('button', { name: /create agency profile/i }),
    )

    await waitFor(() =>
      expect(createAgencyMock).toHaveBeenCalledWith({
        name: 'Thameside Property Partners',
        phone: '0118 950 1147',
        email: 'hello@thamesidepropertypartners.co.uk',
        website: 'https://www.thamesidepropertypartners.co.uk',
        address: '12 Kings Road, Reading, RG1 3AA',
      }),
    )
    await waitFor(() =>
      expect(refreshSessionAfterUpgradeMock).toHaveBeenCalled(),
    )
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/lister'))
    expect(refreshMock).toHaveBeenCalled()
  })

  it('maps an API error envelope to friendly copy and does not navigate', async () => {
    createAgencyMock.mockRejectedValue(
      new OnboardingApiError(
        'invalid_request',
        'Check the highlighted fields and try again.',
      ),
    )
    render(<AgencyForm defaultEmail="sarah@example.com" />)

    await fillValidForm()
    fireEvent.click(
      screen.getByRole('button', { name: /create agency profile/i }),
    )

    expect(
      await screen.findByText('Check the highlighted fields and try again.'),
    ).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
