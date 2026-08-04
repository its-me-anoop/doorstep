import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const signUpWithEmailMock = vi.fn()
const establishServerSessionMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/firebase-client', () => ({
  signUpWithEmail: (...args: unknown[]) => signUpWithEmailMock(...args),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  establishServerSession: (...args: unknown[]) =>
    establishServerSessionMock(...args),
}))

import { SignUpForm } from '@/components/features/auth/sign-up-form'

async function fillForm({
  fullName = 'Sarah Cole',
  email = 'sarah@example.com',
  password = 'correct-horse',
  consent = true,
}: Partial<{
  fullName: string
  email: string
  password: string
  consent: boolean
}> = {}) {
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: fullName },
  })
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: password },
  })
  if (consent) {
    fireEvent.click(screen.getByRole('checkbox'))
  }
}

describe('SignUpForm', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the full-name, email, password fields, consent checkbox and OAuth row', () => {
    render(<SignUpForm nextPath="/account" />)

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with apple/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('shows the live password-strength hint turning satisfied without any red state while typing', () => {
    render(<SignUpForm nextPath="/account" />)

    const hint = screen.getByText('At least 8 characters')
    expect(hint).toHaveClass('text-muted-foreground')

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'short' },
    })
    expect(hint).not.toHaveClass('text-destructive')
    expect(hint).toHaveClass('text-muted-foreground')

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'longenough' },
    })
    expect(hint).toHaveClass('text-success')
  })

  it('shows the imperative empty-field message for name on submit with no input', async () => {
    render(<SignUpForm nextPath="/account" />)

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument()
    expect(signUpWithEmailMock).not.toHaveBeenCalled()
  })

  it('blocks submission until the consent checkbox is ticked', async () => {
    render(<SignUpForm nextPath="/account" />)

    await fillForm({ consent: false })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(signUpWithEmailMock).not.toHaveBeenCalled()
    })
  })

  it('submits a valid form, establishes the session, then redirects to nextPath', async () => {
    const credential = { user: { uid: 'u1' } }
    signUpWithEmailMock.mockResolvedValue(credential)
    render(<SignUpForm nextPath="/lister?welcome=1" />)

    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(signUpWithEmailMock).toHaveBeenCalledWith(
        'sarah@example.com',
        'correct-horse',
      )
    })
    await waitFor(() => {
      expect(establishServerSessionMock).toHaveBeenCalledWith(credential)
    })
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/lister?welcome=1')
    })
  })

  it('shows a "sign in instead" link pre-filling the email on auth/email-already-in-use', async () => {
    signUpWithEmailMock.mockRejectedValue({
      code: 'auth/email-already-in-use',
    })
    render(<SignUpForm nextPath="/account" />)

    await fillForm({ email: 'taken@example.com' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    const link = await screen.findByRole('link', { name: /sign in instead/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toContain(
      encodeURIComponent('taken@example.com'),
    )
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows the weak-password copy from Firebase at submit time', async () => {
    signUpWithEmailMock.mockRejectedValue({ code: 'auth/weak-password' })
    render(<SignUpForm nextPath="/account" />)

    await fillForm({ password: 'longenough1' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText('Your password needs at least 8 characters.'),
    ).toBeInTheDocument()
  })
})
