/**
 * full-auth.spec.ts — the real-credential sign-in/sign-out journey (PRD
 * §8.8's e2e list). Everything else in this suite runs against
 * placeholder Firebase config (lib/firebase-client.ts's lazy init), which
 * is enough for validation and gating but cannot complete an actual
 * Firebase Auth round trip. This spec is the exception: it drives the
 * real email/password flow against a real Firebase project, so it needs
 * a real account's credentials and stays skipped everywhere else.
 *
 * To run: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to an active,
 * non-suspended account on the target Firebase project (and BASE_URL to
 * an environment wired to that project, since the local placeholder
 * webServer config in playwright.config.ts is not).
 */

import { expect, test } from '@playwright/test'

const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

test.skip(
  !email || !password,
  'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run the real-credential auth flow.',
)

test('signs in with real credentials, lands on /account, then signs out', async ({
  page,
}) => {
  await page.goto('/sign-in')

  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password', { exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/account')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Sign in' }),
  ).toBeVisible()
})
