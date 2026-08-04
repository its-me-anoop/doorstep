/**
 * playwright.config.ts — e2e smoke + accessibility suite (PRD §7.3, §8.8).
 *
 * Two ways to run this:
 *  - BASE_URL set (CI against a preview deploy, or full-auth.spec.ts's
 *    "for later" real-credential run): Playwright talks to that URL
 *    directly and never spawns a server.
 *  - BASE_URL unset (local dev): Playwright builds and starts the app
 *    itself against a throwaway placeholder environment — the same
 *    "serves with placeholder envs" contract lib/composition.ts's
 *    lazily-constructed adapters rely on (no live DATABASE_URL/Firebase
 *    project needed for pages to render or for the session route's
 *    validation/verification-failure paths to respond correctly).
 */

import { generateKeyPairSync } from 'node:crypto'

import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`

/**
 * A freshly generated throwaway key, connected to no Firebase project and
 * used to sign nothing. It must be structurally valid PEM: firebase-admin
 * parses the service-account credential at init, and the session route
 * deliberately maps an unparseable key to 500 (server misconfiguration)
 * while a junk ID token maps to 401 (credential failure). The junk-token
 * spec asserts the 401 path, so the key has to parse.
 */
const THROWAWAY_PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
}).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

/**
 * Placeholder values shaped like .env.example — enough for the app to
 * build and for every route this suite exercises to respond (see
 * adapters/drizzle/client.ts and adapters/firebase/admin-app.ts: both are
 * lazy, so these never need to resolve to a real database or project).
 * Only applied to the spawned webServer process, never to a real
 * BASE_URL target.
 */
const PLACEHOLDER_ENV = {
  DATABASE_URL: 'postgres://user:password@localhost:5432/doorstep',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'doorstep-test.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'doorstep-test',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
  FIREBASE_PROJECT_ID: 'doorstep-test',
  FIREBASE_CLIENT_EMAIL:
    'firebase-adminsdk-test@doorstep-test.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: THROWAWAY_PRIVATE_KEY,
  PORT: String(PORT),
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['line']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: PLACEHOLDER_ENV,
      },
})
