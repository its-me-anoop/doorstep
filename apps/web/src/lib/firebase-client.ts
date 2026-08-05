/**
 * lib/firebase-client.ts — the browser-side Firebase Auth surface. Meant
 * to be called from client components ('use client'); the sign-in/sign-up
 * UI itself is a later milestone, this only exports the helpers it will
 * call (PRD §8.4).
 *
 * The cookie, not the Firebase JS SDK's own in-memory/IndexedDB session,
 * is this app's source of truth for "am I signed in" — every navigation
 * is verified server-side (services/auth's GetCurrentUser). So once an
 * ID token has been exchanged for a session cookie via
 * establishServerSession, the client SDK signs itself out immediately:
 * there is no reason to keep two competing notions of "signed in" around,
 * and it avoids ever sending a now-superfluous Firebase ID token to
 * anything else in the page.
 */

import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth'

const SESSION_ENDPOINT = '/api/v1/auth/session'

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Firebase client auth cannot start.`)
  }
  return value
}

function firebaseConfig(): FirebaseOptions {
  // Each variable must be spelled out as a literal `process.env.NEXT_PUBLIC_*`
  // expression: Next.js inlines client-side env vars by static text
  // replacement at build time, so dynamic access (process.env[name]) is
  // always `undefined` in the browser bundle.
  return {
    apiKey: requireEnv(
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    ),
    authDomain: requireEnv(
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: requireEnv(
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    appId: requireEnv(
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ),
  }
}

function getFirebaseAuth() {
  const app = getApps()[0] ?? initializeApp(firebaseConfig())
  return getAuth(app)
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
}

export async function signInWithApple(): Promise<UserCredential> {
  return signInWithPopup(getFirebaseAuth(), new OAuthProvider('apple.com'))
}

/** POSTs an ID token to the session endpoint, throwing `message` if the
 * exchange fails. Shared by establishServerSession (a fresh sign-in) and
 * refreshSessionAfterUpgrade (an existing session's claim refresh) — both
 * mint a session cookie from an ID token the same way, they differ only in
 * where that token comes from. */
async function exchangeIdTokenForSession(
  idToken: string,
  message: string,
): Promise<void> {
  const response = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) {
    throw new Error(message)
  }
}

/**
 * Exchanges a freshly signed-in credential's ID token for a server
 * session cookie, then signs the client SDK out (see this file's doc
 * comment for why). Throws if the exchange fails — the caller's sign-in
 * flow should surface that rather than silently leaving the user
 * "signed in" to Firebase but without a working session cookie.
 */
export async function establishServerSession(
  credential: UserCredential,
): Promise<void> {
  const idToken = await credential.user.getIdToken()

  await exchangeIdTokenForSession(idToken, 'Failed to establish server session')

  await signOut(getFirebaseAuth())
}

/** Ends the server session and signs the client SDK out. Safe to call
 * even if the client SDK has no active session (establishServerSession
 * already signs it out on every successful sign-in). */
export async function signOutEverywhere(): Promise<void> {
  await fetch(SESSION_ENDPOINT, { method: 'DELETE' })
  await signOut(getFirebaseAuth())
}

/**
 * refreshSessionAfterUpgrade — the client-side half of a role upgrade's
 * "claim refresh dance" (PRD §8.4: "claims refresh on next token refresh,
 * forced after upgrade"). AuthGateway.setRoleClaims (services/listers/*)
 * only affects *future* Firebase token mints — the still-active session
 * cookie already in the browser keeps the role/agencyId claims it was
 * minted with until a fresh ID token is exchanged for a new cookie.
 * Firebase's `getIdToken(true)` forces exactly that: a round trip to
 * Firebase that re-fetches the account's current custom claims (instead of
 * serving a cached, pre-upgrade token), which the resulting POST to
 * /api/v1/auth/session then bakes into a freshly minted cookie.
 *
 * This is UX-gating only, not a security boundary: proxy.ts's route gate
 * (src/proxy.ts, lib/decide-gate.ts) reads the cookie's claim purely to
 * avoid flashing a page shell the user shouldn't see; every service call
 * re-derives authorisation from the `users.role` column via
 * GetCurrentUser (PRD §8.4), never from the claim. If this refresh never
 * runs, the worst outcome is the *cookie's* claim staying stale until it
 * is next reissued (sign-out/sign-in, or the cookie's natural 14-day
 * expiry), which only affects which pages proxy.ts pre-emptively allows —
 * it can never grant a capability the DB role does not.
 *
 * Requires a live Firebase Auth user (`getAuth().currentUser`). Per this
 * file's top doc comment, the client SDK is signed out immediately after
 * every sign-in — so this only has anything to refresh when called from
 * the same page/session that still holds a live Firebase user (for
 * example, immediately after the onboarding UI's own upgrade request
 * succeeds, before any navigation away). Throws if there is no live user
 * to refresh a token from, or if the re-POST fails; on success, signs the
 * client SDK out again afterwards, restoring the invariant that the
 * cookie — not the SDK's own session — is this app's source of truth.
 */
export async function refreshSessionAfterUpgrade(): Promise<void> {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) {
    throw new Error(
      'refreshSessionAfterUpgrade: no live Firebase user to refresh a token from',
    )
  }

  const idToken = await user.getIdToken(true)

  await exchangeIdTokenForSession(
    idToken,
    'Failed to refresh server session after role upgrade',
  )

  await signOut(auth)
}
