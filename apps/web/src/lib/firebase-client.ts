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

  const response = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) {
    throw new Error('Failed to establish server session')
  }

  await signOut(getFirebaseAuth())
}

/** Ends the server session and signs the client SDK out. Safe to call
 * even if the client SDK has no active session (establishServerSession
 * already signs it out on every successful sign-in). */
export async function signOutEverywhere(): Promise<void> {
  await fetch(SESSION_ENDPOINT, { method: 'DELETE' })
  await signOut(getFirebaseAuth())
}
