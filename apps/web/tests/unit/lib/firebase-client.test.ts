import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signOutMock = vi.fn().mockResolvedValue(undefined)
const getAuthMock = vi.fn().mockReturnValue({ __brand: 'fake-auth' })

vi.mock('firebase/auth', () => ({
  getAuth: getAuthMock,
  signOut: signOutMock,
  GoogleAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn().mockReturnValue({ __brand: 'fake-app' }),
  getApps: vi.fn().mockReturnValue([]),
}))

describe('lib/firebase-client', () => {
  const originalEnv = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key'
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
      'doorstep-dev.firebaseapp.com'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'doorstep-dev'
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'test-app-id'

    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    signOutMock.mockClear()
    getAuthMock.mockClear()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })

  it('establishServerSession POSTs the ID token then signs the client SDK out', async () => {
    const { establishServerSession } = await import('@/lib/firebase-client')

    const credential = {
      user: { getIdToken: vi.fn().mockResolvedValue('fresh-id-token') },
    }

    await establishServerSession(credential as never)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ idToken: 'fresh-id-token' }),
      }),
    )
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('establishServerSession throws and does not sign out when the session request fails', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    const { establishServerSession } = await import('@/lib/firebase-client')

    const credential = {
      user: { getIdToken: vi.fn().mockResolvedValue('bad-id-token') },
    }

    await expect(establishServerSession(credential as never)).rejects.toThrow()
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('signOutEverywhere DELETEs the session then signs the client SDK out', async () => {
    const { signOutEverywhere } = await import('@/lib/firebase-client')

    await signOutEverywhere()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/session',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('throws a clear error when a required NEXT_PUBLIC_FIREBASE_* var is missing', async () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const { signInWithEmail } = await import('@/lib/firebase-client')

    await expect(signInWithEmail('a@b.co', 'password')).rejects.toThrow(
      /NEXT_PUBLIC_FIREBASE_API_KEY/,
    )
  })

  // refreshSessionAfterUpgrade — the client-side half of PRD §8.4's
  // "claims refresh on next token refresh, forced after upgrade". See its
  // doc comment in lib/firebase-client.ts for the full reasoning.
  describe('refreshSessionAfterUpgrade', () => {
    it('forces a fresh ID token from the live Firebase user, re-POSTs it, then signs out', async () => {
      const getIdToken = vi.fn().mockResolvedValue('fresh-post-upgrade-token')
      getAuthMock.mockReturnValueOnce({ currentUser: { getIdToken } })
      const { refreshSessionAfterUpgrade } =
        await import('@/lib/firebase-client')

      await refreshSessionAfterUpgrade()

      expect(getIdToken).toHaveBeenCalledWith(true)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/auth/session',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ idToken: 'fresh-post-upgrade-token' }),
        }),
      )
      expect(signOutMock).toHaveBeenCalledTimes(1)
    })

    it('throws without calling fetch when there is no live Firebase user to refresh', async () => {
      getAuthMock.mockReturnValueOnce({ currentUser: null })
      const { refreshSessionAfterUpgrade } =
        await import('@/lib/firebase-client')

      await expect(refreshSessionAfterUpgrade()).rejects.toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(signOutMock).not.toHaveBeenCalled()
    })

    it('throws and does not sign out when the re-POST fails', async () => {
      const getIdToken = vi.fn().mockResolvedValue('fresh-post-upgrade-token')
      getAuthMock.mockReturnValueOnce({ currentUser: { getIdToken } })
      fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
      const { refreshSessionAfterUpgrade } =
        await import('@/lib/firebase-client')

      await expect(refreshSessionAfterUpgrade()).rejects.toThrow()
      expect(signOutMock).not.toHaveBeenCalled()
    })
  })
})
