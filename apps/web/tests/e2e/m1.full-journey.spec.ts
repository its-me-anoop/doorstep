/**
 * m1.full-journey.spec.ts — the real-credential lister journeys behind M1
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
 * To run: set E2E_TEST_EMAIL/E2E_TEST_PASSWORD (owner journey) and/or
 * E2E_AGENT_EMAIL/E2E_AGENT_PASSWORD (agent journey) to active,
 * non-suspended accounts on the target Firebase project, and BASE_URL to
 * an environment wired to that project's Postgres + Storage (the local
 * placeholder webServer config in playwright.config.ts is not). The two
 * journeys are gated independently (each `test.skip` lives in its own
 * scope — the agent journey's inside its `test.describe`, exactly like
 * this file previously gated its still-unimplemented placeholder) so
 * either pair, both pairs, or neither can be set without one journey's
 * missing credentials skipping the other.
 *
 * Owner journey: sign in, onboard as owner if not already a lister
 * (resilient — an account this suite has already run against stays an
 * owner, so the onboarding step is skipped, not re-asserted as a
 * failure), dashboard renders, create a listing, fill the wizard with
 * realistic Reading data end to end (postcode RG1 8BT — a real
 * postcodes.io lookup, not a stub) on the *sale* channel, upload one
 * real photo through the full 3-call pipeline (signed URL -> PUT ->
 * process), review, submit, and confirm it lands back on the dashboard
 * as "Pending review."
 *
 * Agent journey: sign in, onboard as agent if not already one (the same
 * resilient-skip shape as the owner journey — RoleChoice's "I'm an
 * agent" -> AgencyForm -> CreateAgency,
 * services/listers/create-agency.ts, only ever runs once per account,
 * since CreateAgency.execute's requireRole rejects an actor already on
 * an agency), dashboard renders, create a listing on the *rent*
 * channel — the channel-conditional path the owner journey above never
 * exercises: furnished, available-from and deposit render, and EPC
 * rating is required at submit rather than optional
 * (applyChannelConditionalRequirements, lib/validation/listing.ts) —
 * with a second real postcodes.io lookup (RG4, Caversham) and a second
 * real photo upload. Review confirms the rent-specific "£n pcm" price
 * formatting (domain/money.ts) alongside the photo, and the dashboard
 * again shows "Pending review."
 *
 * Axe scans (same WCAG tags as a11y.spec.ts) run authenticated on
 * /onboarding and /onboarding/agency (when reached), every wizard step,
 * and the dashboard, in both journeys — this is the one place in the
 * suite that can exercise those pages' *authenticated* rendering at
 * all, so skipping the scans here would mean they never run anywhere.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations).toEqual([])
}

test.describe('owner onboarding and sale-listing journey', () => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD

  // Scoped to this describe, not file-top-level: `test.skip(condition,
  // description)` outside a test body skips every test in its *entire*
  // enclosing scope (Playwright's own documented behaviour — "you can
  // skip all tests in a file or test.describe group with a single
  // test.skip call"). A file-top-level call here would cascade into the
  // agent journey's describe below too, so setting only
  // E2E_AGENT_EMAIL/PASSWORD (without these) would incorrectly skip the
  // agent journey as well — the two journeys need independent gates,
  // each living in its own describe.
  test.skip(
    !email || !password,
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run the real-credential M1 owner journey.',
  )

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

      // `.first()`: this account's suite has run before (real, persisted
      // DB, same fixed address every run), so more than one matching row
      // can exist. properties.id is a UUIDv7 (schema.ts's idColumn) and
      // the dashboard orders `desc(properties.id)` (listing-repository.ts)
      // — newest first — so `.first()` is unambiguously *this* run's
      // listing, not an arbitrary pick among duplicates.
      const row = page
        .locator('[aria-live="polite"]')
        .filter({ hasText: 'Kings Road, Reading, RG1' })
        .first()
      await expect(row).toBeVisible()
      await expect(row.getByText('Pending review')).toBeVisible()
    })
  })
})

test.describe('agent onboarding and rent-listing journey', () => {
  const agentEmail = process.env.E2E_AGENT_EMAIL
  const agentPassword = process.env.E2E_AGENT_PASSWORD

  test.skip(
    !agentEmail || !agentPassword,
    'Set E2E_AGENT_EMAIL and E2E_AGENT_PASSWORD to run the real-credential M1 agent journey.',
  )

  test('an agent signs in, sets up an agency, and takes a rent listing from draft to Pending review', async ({
    page,
  }) => {
    // Same reasoning as the owner journey above: real postcodes.io
    // lookup, real sharp/image-storage pipeline, real Firebase Auth
    // round trip, plus a real agency-creation round trip.
    test.setTimeout(180_000)

    await page.emulateMedia({ reducedMotion: 'reduce' })

    await test.step('sign in with real credentials', async () => {
      await page.goto('/sign-in')
      await page.getByLabel('Email').fill(agentEmail!)
      await page.getByLabel('Password', { exact: true }).fill(agentPassword!)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/account')
    })

    await test.step('onboard as agent (resilient skip if already an agent)', async () => {
      await page.goto('/onboarding')

      if (new URL(page.url()).pathname === '/onboarding') {
        // A `role: 'user'` account lands on the role-choice screen, same
        // as the owner journey's fresh-account path.
        await expect(
          page.getByRole('heading', {
            level: 1,
            name: 'How would you like to list?',
          }),
        ).toBeVisible()

        await expectNoAxeViolations(page)

        // RoleOption's accessible name is its heading + description
        // text combined ("I’m an agent Create your agency profile…") —
        // matching on "an agent" alone (present only in the heading)
        // sidesteps the smart-quote apostrophe, same spirit as the
        // owner journey's `/private owner or landlord/` match.
        await page.getByRole('button', { name: /an agent/ }).click()
        await expect(page).toHaveURL('/onboarding/agency')

        await expect(
          page.getByRole('heading', { level: 1, name: 'Set up your agency' }),
        ).toBeVisible()

        // New surface — agency-form.tsx has no other real-credential
        // authenticated coverage anywhere in this suite.
        await expectNoAxeViolations(page)

        await page.getByLabel('Agency name').fill('Kennet & Thames Lettings')
        await page.getByLabel('Phone').fill('0118 950 1147')
        await page.getByLabel('Email').fill('lettings@kennetthames.co.uk')
        await page
          .getByLabel('Website')
          .fill('https://www.kennetthames-lettings.co.uk')
        await page
          .getByLabel('Branch address')
          .fill('8 Bridge Street, Reading, RG1 2LU')

        await page
          .getByRole('button', { name: 'Create agency profile' })
          .click()
        await expect(page).toHaveURL('/lister', { timeout: 15_000 })
      } else {
        // Already an agent from a previous run of this same suite (real,
        // persisted DB) — resilient-skip branch, not a failure. Also
        // covers CreateAgency.execute's requireRole rejecting a second
        // create-agency call for an actor already on one.
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

    await test.step('wizard step 1 — channel and property type (rent path)', async () => {
      await page.getByRole('button', { name: 'To rent' }).click()
      await page.getByLabel('Property type').selectOption('flat')

      await expectNoAxeViolations(page)

      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(
        page.getByRole('heading', { level: 2, name: 'Where is it?' }),
      ).toBeVisible()
    })

    await test.step('wizard step 2 — address (real RG4 5AS postcodes.io lookup)', async () => {
      await page.getByLabel('Postcode').fill('RG4 5AS')
      await page.getByRole('button', { name: 'Find address' }).click()
      await expect(page.getByText('Found: Reading, RG4.')).toBeVisible({
        timeout: 15_000,
      })

      await page.getByLabel('Address line 1').fill('14 Church Road')

      await expectNoAxeViolations(page)

      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: 'Tell us about the property',
        }),
      ).toBeVisible()
    })

    await test.step('wizard step 3 — rental details (furnished, available from, deposit, EPC)', async () => {
      await page.getByLabel('Bedrooms').selectOption('2')
      await page.getByLabel('Bathrooms').selectOption('1')
      await page.getByLabel('Rent').fill('1450')
      await page.getByLabel('Furnished').selectOption('furnished')
      await page.getByRole('button', { name: 'Now' }).click()
      await page.getByLabel('Deposit').fill('1670')
      await page.getByLabel('EPC rating').selectOption('D')

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
          'A bright two-bedroom flat on Church Road in Caversham, a short ' +
            'stroll from the Thames towpath and the independent shops and ' +
            'cafes nearby. The open-plan living space leads onto a private ' +
            'balcony, and both bedrooms are well-proportioned with plenty ' +
            'of natural light. Reading town centre and the mainline ' +
            'station are a quick bus ride away, making this an easy base ' +
            'for commuters.',
        )
      await page.getByRole('button', { name: 'Double glazing' }).click()
      await page.getByRole('button', { name: 'Near the station' }).click()

      await expectNoAxeViolations(page)

      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(
        page.getByRole('heading', { level: 2, name: 'Add your photos' }),
      ).toBeVisible()
    })

    await test.step('wizard step 5 — upload one photo through the real 3-call pipeline', async () => {
      const photo = await sharp({
        create: {
          width: 32,
          height: 24,
          channels: 3,
          background: { r: 122, g: 142, b: 118 },
        },
      })
        .png()
        .toBuffer()

      await page.getByLabel('Add photos').setInputFiles({
        name: 'church-road-photo.png',
        mimeType: 'image/png',
        buffer: photo,
      })

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
      await expect(page.getByText('Church Road, Reading, RG4')).toBeVisible()
      // priceQualifier is force-set to 'fixed' for every rent listing
      // (step-details.tsx), so formatPrice adds no prefix — just the
      // rent-only " pcm" suffix (domain/money.ts).
      await expect(page.getByText('£1,450 pcm')).toBeVisible()
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

      // `.first()`: same reasoning as the owner journey's matching step —
      // a rerun of this suite against this account leaves more than one
      // matching row, and the dashboard's `desc(properties.id)` ordering
      // (a UUIDv7 primary key) makes `.first()` unambiguously this run's
      // listing.
      const row = page
        .locator('[aria-live="polite"]')
        .filter({ hasText: 'Church Road, Reading, RG4' })
        .first()
      await expect(row).toBeVisible()
      await expect(row.getByText('Pending review')).toBeVisible()
    })
  })
})
