import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}))

const signInWithEmailMock = vi.fn()
const establishServerSessionMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/firebase-client', () => ({
  signInWithEmail: (...args: unknown[]) => signInWithEmailMock(...args),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  establishServerSession: (...args: unknown[]) =>
    establishServerSessionMock(...args),
}))

import { SignInForm } from '@/components/features/auth/sign-in-form'

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
}

describe('SignInForm', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the email/password fields, OAuth row, and secondary links', () => {
    render(<SignInForm nextPath="/account" />)

    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with apple/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /forgot password/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /create an account/i }),
    ).toBeInTheDocument()
  })

  it('pre-fills the email field when prefillEmail is given', () => {
    render(<SignInForm nextPath="/account" prefillEmail="sarah@example.com" />)

    expect(screen.getByLabelText(/^email$/i)).toHaveValue('sarah@example.com')
  })

  it('shows the imperative empty-field message on submit with no input', async () => {
    render(<SignInForm nextPath="/account" />)

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(
      await screen.findByText('Enter your email address.'),
    ).toBeInTheDocument()
    expect(signInWithEmailMock).not.toHaveBeenCalled()
  })

  it('submits valid credentials, establishes the session, then redirects to nextPath', async () => {
    const credential = { user: { uid: 'u1' } }
    signInWithEmailMock.mockResolvedValue(credential)
    render(<SignInForm nextPath="/lister" />)

    await fillAndSubmit('sarah@example.com', 'correct-horse')

    await waitFor(() => {
      expect(signInWithEmailMock).toHaveBeenCalledWith(
        'sarah@example.com',
        'correct-horse',
      )
    })
    await waitFor(() => {
      expect(establishServerSessionMock).toHaveBeenCalledWith(credential)
    })
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/lister')
    })
  })

  it('shows the non-enumerating credential-mismatch copy and does not redirect on failure', async () => {
    signInWithEmailMock.mockRejectedValue({ code: 'auth/wrong-password' })
    render(<SignInForm nextPath="/account" />)

    await fillAndSubmit('sarah@example.com', 'wrong-password')

    expect(
      await screen.findByText(
        "That email and password don't match. Try again, or reset your password.",
      ),
    ).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows the generic fallback copy for an unrecognised Firebase error', async () => {
    signInWithEmailMock.mockRejectedValue({
      code: 'auth/network-request-failed',
    })
    render(<SignInForm nextPath="/account" />)

    await fillAndSubmit('sarah@example.com', 'whatever123')

    expect(
      await screen.findByText(
        'Something went wrong on our end — try again in a moment.',
      ),
    ).toBeInTheDocument()
  })
})
