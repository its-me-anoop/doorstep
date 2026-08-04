/**
 * smoke.auth.spec.ts — critical-journey smoke coverage for the public
 * marketing shell and the auth boundary (PRD §7.3, §8.8's e2e list:
 * "sign up and save a favourite" starts here at the sign-up/sign-in
 * step).
 *
 * Scope deliberately excludes anything requiring a real Firebase project
 * (popup OAuth, an actual email/password account) — that's
 * full-auth.spec.ts, gated on real credentials. This file covers what's
 * true with placeholder envs: page rendering, navigation, route gating
 * (proxy.ts / decide-gate.ts), client-side validation copy
 * (lib/validation/auth.ts), and the session route's request-validation
 * and token-verification-failure paths (route.ts's own try/catch, which
 * never needs a live Firebase project to be exercised).
 */

import { expect, test } from '@playwright/test'

test.describe('landing page', () => {
  test('loads with a heading, header sign-in link and footer', async ({
    page,
  }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (error) => pageErrors.push(error))

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'A property site that actually knows Reading.',
      }),
    ).toBeVisible()

    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Sign in' }),
    ).toBeVisible()

    await expect(page.getByRole('contentinfo')).toBeVisible()

    expect(pageErrors).toEqual([])
  })
})

test.describe('navigation', () => {
  test('landing to sign-in to sign-up and back', async ({ page }) => {
    await page.goto('/')

    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Sign in' })
      .click()
    await expect(page).toHaveURL('/sign-in')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in' }),
    ).toBeVisible()

    // The sign-in/sign-up forms preserve a `?next=` between each other
    // (sanitizeNextPath falls back to /account when none was present), so
    // these assertions match on pathname only, not the full URL.
    await page.getByRole('link', { name: 'Create an account' }).click()
    await expect(page).toHaveURL(/\/sign-up(\?.*)?$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeVisible()

    // Scoped to <main> — the header also has a "Sign in" link, and this
    // step is exercising the form's own "back to sign-in" link.
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Sign in', exact: true })
      .click()
    await expect(page).toHaveURL(/\/sign-in(\?.*)?$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sign in' }),
    ).toBeVisible()
  })
})

test.describe('route gating (proxy.ts)', () => {
  for (const path of ['/account', '/lister', '/admin']) {
    test(`redirects an unauthenticated request for ${path} to sign-in with an exact next param`, async ({
      page,
    }) => {
      await page.goto(path)
      await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(path)}`)
    })
  }
})

test.describe('sign-in form validation', () => {
  test('empty submit shows the required-field messages', async ({ page }) => {
    await page.goto('/sign-in')

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Enter your email address.')).toBeVisible()
    await expect(page.getByText('Enter your password.')).toBeVisible()
  })

  test('a badly-formatted email shows the format message', async ({ page }) => {
    await page.goto('/sign-in')

    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password', { exact: true }).fill('irrelevant')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByText(
        "That email address doesn't look quite right — check for typos.",
      ),
    ).toBeVisible()
  })
})

test.describe('sign-up form validation', () => {
  test('a short password is flagged as not meeting the requirement', async ({
    page,
  }) => {
    await page.goto('/sign-up')

    const hint = page.getByText('At least 8 characters')
    await expect(hint).toBeVisible()
    // Untouched: neutral, not yet styled as an error.
    await expect(hint).not.toHaveClass(/text-destructive/)

    const passwordField = page.getByLabel('Password', { exact: true })
    await passwordField.fill('short')
    await passwordField.blur()

    await expect(hint).toHaveClass(/text-destructive/)
  })
})

test.describe('POST /api/v1/auth/session', () => {
  test('a garbage body returns 400 with an invalid_request error envelope', async ({
    request,
  }) => {
    const response = await request.post('/api/v1/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not json at all',
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ error: { code: 'invalid_request' } })
  })

  test('a junk idToken returns 401 with an invalid_credential error envelope', async ({
    request,
  }) => {
    const response = await request.post('/api/v1/auth/session', {
      data: { idToken: 'junk-not-a-real-token' },
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body).toMatchObject({ error: { code: 'invalid_credential' } })
  })
})

test.describe('DELETE /api/v1/auth/session', () => {
  test('clears the session cookie', async ({ request }) => {
    const response = await request.delete('/api/v1/auth/session')

    expect(response.status()).toBe(200)
    const setCookie = response.headers()['set-cookie'] ?? ''
    expect(setCookie).toContain('__session=;')
    expect(setCookie).toMatch(/Max-Age=0/i)
  })
})
