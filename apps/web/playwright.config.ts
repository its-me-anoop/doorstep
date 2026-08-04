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

import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`

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
  FIREBASE_PRIVATE_KEY:
    '-----BEGIN PRIVATE KEY-----\nMIIBVgIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA0Z\n-----END PRIVATE KEY-----\n',
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
