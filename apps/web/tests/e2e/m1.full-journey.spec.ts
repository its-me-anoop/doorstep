/**
 * m1.full-journey.spec.ts — the real-credential owner journey behind M1
 * (PRD §6.5 LST-1 through LST-3, §8.8's "create listing to approval to
 * live in search" critical journey — this spec covers everything up to
 * "in for review"; the approve-to-live half is admin/search scope, out
 * of bounds for this milestone). Mirrors full-auth.spec.ts's own
 * pattern exactly: everything else in the e2e suite runs against
 * placeholder Firebase config, which is enough for gating and rendering
 * but cannot complete a real Firebase Auth round trip or a real
 * postcodes.io/image-storage call. This spec is the exception — it
 * needs a real account on a real Firebase project, plus a real Postgres
 * and Firebase Storage behind BASE_URL, so it stays skipped everywhere
 * else.
 *
 * To run: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to an active,
 * non-suspended account on the target Firebase project, and BASE_URL to
 * an environment wired to that project's Postgres + Storage (the local
 * placeholder webServer config in playwright.config.ts is not).
 *
 * Owner journey (below): sign in, onboard as owner if not already a
 * lister (resilient — an account this suite has already run against
 * stays an owner, so the onboarding step is skipped, not re-asserted as
 * a failure), dashboard renders, create a listing, fill the wizard with
 * realistic Reading data end to end (postcode RG1 8BT — a real
 * postcodes.io lookup, not a stub), upload one real photo through the
 * full 3-call pipeline (signed URL -> PUT -> process), review, submit,
 * and confirm it lands back on the dashboard as "Pending review." Axe
 * scans (same WCAG tags as a11y.spec.ts) run authenticated on
 * /onboarding (when reached), every wizard step, and the dashboard —
 * this is the one place in the suite that can exercise those pages'
 * *authenticated* rendering at all, so skipping the scans here would
 * mean they never run anywhere.
 *
 * Agent journey — documented gap, not implemented: M1 has no second
 * real-credential account provisioned (no env var pair analogous to
 * E2E_TEST_EMAIL/PASSWORD exists for an agent identity anywhere in this
 * repo's env contract), so RoleChoice's "I'm an agent" ->
 * agency-form.tsx -> agency-scoped listing path has no real-credential
 * *journey* coverage yet, only the unit/integration coverage
 * CreateAgency (services/listers/create-agency.ts) and agency-form.tsx
 * already have in isolation. The skipped placeholder test below records
 * that gap explicitly rather than silently omitting it.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

test.skip(
  !email || !password,
  'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run the real-credential M1 owner journey.',
)

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations).toEqual([])
}

test('an owner signs in, onboards, and takes a listing from draft to Pending review', async ({
  page,
}) => {
  // Real postcodes.io lookup, real sharp/image-storage pipeline, real
  // Firebase Auth round trip — all slower than a placeholder-env run.
  test.setTimeout(180_000)

  // Same reasoning as a11y.spec.ts: set before the very first navigation
  // so the landing/wizard/dashboard entrance and autosave-status fades
  // never get caught mid-transition by an axe scan.
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await test.step('sign in with real credentials', async () => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email!)
    await page.getByLabel('Password', { exact: true }).fill(password!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/account')
  })

  await test.step('onboard as owner (resilient skip if already a lister)', async () => {
    await page.goto('/onboarding')

    if (new URL(page.url()).pathname === '/onboarding') {
      // A `role: 'user'` account lands on the role-choice screen — this
      // is the fresh-account path (M1-DESIGN-SPEC.md §2.1).
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'How would you like to list?',
        }),
      ).toBeVisible()

      await expectNoAxeViolations(page)

      await page
        .getByRole('button', { name: /private owner or landlord/ })
        .click()
      await expect(page).toHaveURL('/lister')
    } else {
      // Already owner/agent/admin from a previous run of this same
      // suite (real, persisted DB) — the (lister) layout's DB-backed
      // check already redirected /onboarding straight to /lister
      // (lib/decide-gate.ts's "TWO-TIER GATING" doc comment). Nothing
      // left to do here; this is the resilient-skip branch, not a
      // failure.
      await expect(page).toHaveURL('/lister')
    }
  })

  await test.step('dashboard renders', async () => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Your listings' }),
    ).toBeVisible()

    await expectNoAxeViolations(page)
  })

  await test.step('create a new listing', async () => {
    // shadcn Button rendered onto a Link via Base UI's `render` prop
    // (button.tsx) still exposes role="button", not "link" — see
    // m1.smoke.spec.ts's matching comment on the for-agents CTA.
    await page
      .locator('main')
      .getByRole('button', { name: 'Add a listing' })
      .first()
      .click()

    await page.waitForURL(/\/lister\/listings\/[^/]+\/edit(\?.*)?$/)
    await expect(
      page.getByRole('heading', { level: 2, name: 'What are you listing?' }),
    ).toBeVisible()
  })

  await test.step('wizard step 1 — channel and property type', async () => {
    await page.getByRole('button', { name: 'For sale' }).click()
    await page.getByLabel('Property type').selectOption('semi_detached')

    await expectNoAxeViolations(page)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Where is it?' }),
    ).toBeVisible()
  })

  await test.step('wizard step 2 — address (real RG1 8BT postcodes.io lookup)', async () => {
    await page.getByLabel('Postcode').fill('RG1 8BT')
    await page.getByRole('button', { name: 'Find address' }).click()
    await expect(page.getByText('Found: Reading, RG1.')).toBeVisible({
      timeout: 15_000,
    })

    await page.getByLabel('Address line 1').fill('24 Kings Road')

    await expectNoAxeViolations(page)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Tell us about the property',
      }),
    ).toBeVisible()
  })

  await test.step('wizard step 3 — details', async () => {
    await page.getByLabel('Bedrooms').selectOption('3')
    await page.getByLabel('Bathrooms').selectOption('1')
    await page.getByLabel('Price', { exact: true }).fill('425000')
    await page.getByLabel('Price qualifier').selectOption('guide_price')
    await page.getByLabel('Tenure').selectOption('freehold')
    await page.getByLabel('Council tax band').selectOption('D')

    await expectNoAxeViolations(page)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Describe the property' }),
    ).toBeVisible()
  })

  await test.step('wizard step 4 — description and features', async () => {
    await page
      .getByLabel('Description')
      .fill(
        'A well-presented three-bedroom semi-detached home moments from ' +
          'Reading town centre and the mainline station. The bright ' +
          'reception room opens onto a private, south-facing garden, and ' +
          'the kitchen-diner is ideal for entertaining. Upstairs, three ' +
          'good-sized bedrooms share a modern family bathroom. Off-street ' +
          'parking completes an easy walk to the station for London ' +
          'commuters.',
      )
    await page.getByRole('button', { name: 'Garden' }).click()
    await page.getByRole('button', { name: 'Off-street parking' }).click()

    await expectNoAxeViolations(page)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Add your photos' }),
    ).toBeVisible()
  })

  await test.step('wizard step 5 — upload one photo through the real 3-call pipeline', async () => {
    // A tiny, genuinely-decodable PNG (not a hand-rolled byte stub) —
    // generated with the same sharp this app's own image pipeline uses,
    // so the request-upload -> PUT -> process round trip below exercises
    // real image decoding, not a mocked short-circuit.
    const photo = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 178, g: 148, b: 116 },
      },
    })
      .png()
      .toBuffer()

    await page.getByLabel('Add photos').setInputFiles({
      name: 'kings-road-photo.png',
      mimeType: 'image/png',
      buffer: photo,
    })

    // Visible only once the tile has left the uploading/processing
    // states — proves requestImageUpload -> uploadOriginalBytes ->
    // processListingImage all completed for real.
    await expect(page.getByAltText('Property photo 1')).toBeVisible({
      timeout: 30_000,
    })

    await expectNoAxeViolations(page)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: 'Review your listing' }),
    ).toBeVisible()
  })

  await test.step('review and submit for approval', async () => {
    await expect(page.getByText('Kings Road, Reading, RG1')).toBeVisible()
    await expect(page.getByText('Guide price £425,000')).toBeVisible()
    await expect(page.getByText('1 photo added')).toBeVisible()

    await expectNoAxeViolations(page)

    await page.getByRole('button', { name: 'Submit for approval' }).click()

    await expect(
      page.getByRole('heading', { level: 2, name: /is in for review/ }),
    ).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Back to your listings' }).click()
  })

  await test.step('dashboard shows the listing as Pending review', async () => {
    await expect(page).toHaveURL('/lister')

    const row = page
      .locator('[aria-live="polite"]')
      .filter({ hasText: 'Kings Road, Reading, RG1' })
    await expect(row).toBeVisible()
    await expect(row.getByText('Pending review')).toBeVisible()
  })
})

test.describe('agent onboarding + listing journey', () => {
  test.skip(
    true,
    "No second real-credential account exists yet (an agent-identity env var pair analogous to E2E_TEST_EMAIL/PASSWORD) — see this file's header comment for the documented gap.",
  )

  test('an agent creates an agency profile and lists a property', async () => {
    // Intentionally unimplemented — see the skip reason above.
  })
})
