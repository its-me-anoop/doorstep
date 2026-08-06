/**
 * m2.smoke.spec.ts — CI-safe M2 coverage (PRD §6.1 SRCH-1..4/SRCH-7,
 * §7.2, §7.3, §7.6, §8.3), run against the same placeholder-Firebase,
 * no-live-Postgres, no-Meilisearch webServer m1.smoke.spec.ts and
 * a11y.spec.ts already run against (see playwright.config.ts's own doc
 * comment). This file's whole point is proving PRD §7.6's degradation
 * promise for real: a visitor hitting a public search surface with both
 * backing infrastructure dependencies unreachable gets a calm, rendered
 * page — never a raw crash — and a genuinely unknown listing 404s
 * cleanly rather than 500ing.
 *
 * Confirmed empirically (not assumed) by running a placeholder-env build
 * locally with DATABASE_URL pointed at a closed port and MEILISEARCH_HOST
 * unset — the exact combination this webServer config produces — before
 * writing the assertions below:
 *
 *  - `/for-sale` (no location, so no Postgres read at all — only the
 *    Meilisearch-backed results grid): search_unavailable, deterministic
 *    OutagePanel ("Search's taking a breather.").
 *  - `/for-sale/reading` (an area page: Postgres-backed intro copy +
 *    newest-strip, Meilisearch-backed grid): renders its full shell —
 *    intro paragraph, breadcrumb, filter bar — with the results grid
 *    itself in the same OutagePanel state as `/for-sale`, and silently no
 *    "Newest in Reading" strip (search-results-page.tsx's
 *    `fetchNewestInArea` fallback, added alongside this spec after a real
 *    run against this exact environment first turned up a 500 here).
 *  - `/property/{unknown slug}`: a clean 404 (property/[slug]/page.tsx's
 *    `loadListing`, broadened alongside this spec for the same reason —
 *    a real infrastructure failure inside GetPublicListing used to
 *    propagate uncaught and 500, indistinguishable to an operator from a
 *    genuine bug; it now renders the same not-found response an unknown
 *    slug already produced, logged server-side either way).
 *
 * The full, real-backend journey (guided search landing on real results,
 * filtering, sorting, opening a listing) lives in
 * m2.search-journey.spec.ts, gated on RUN_LOCAL_STACK_E2E=1 — this file
 * deliberately never asserts real result data, only that the shell always
 * renders.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.describe('unrestricted results tier — search-index outage degrades in place (PRD §7.6)', () => {
  test('/for-sale renders the full shell and never a raw crash when the search index is unreachable', async ({
    page,
  }) => {
    const response = await page.goto('/for-sale')
    expect(response?.status()).toBe(200)

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Homes for sale in Reading & the Thames Valley',
      }),
    ).toBeVisible()

    // Page chrome around the (possibly degraded) results slot stays
    // rendered and interactive either way — §1.10 point 4's "not a
    // full-page takeover" — so these are asserted regardless of which
    // state the grid itself lands in below.
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toContainText('Home / For sale')
    await expect(page.getByRole('button', { name: 'Price' })).toBeVisible()

    // The grid slot itself: this webServer has no live Meilisearch, so
    // the deterministic, confirmed outcome is the outage panel — asserted
    // precisely, not just "didn't crash," since that panel's exact copy
    // is the PRD §7.6 contract this test exists to prove. Written to also
    // accept a genuinely empty result set so this stays meaningful if a
    // future CI environment adds a real-but-empty search index instead.
    const outage = page.getByRole('heading', {
      level: 2,
      name: /Search.s taking a breather\./,
    })
    const empty = page.getByRole('heading', {
      level: 2,
      name: 'Nothing matches those filters yet.',
    })
    await expect(outage.or(empty)).toBeVisible()
  })

  test('/property/unknown-slug-e2e-smoke 404s cleanly rather than crashing', async ({
    page,
  }) => {
    const response = await page.goto('/property/unknown-slug-e2e-smoke')
    expect(response?.status()).toBe(404)
  })

  test('area page /for-sale/reading renders its shell without a live database or search index', async ({
    page,
  }) => {
    const response = await page.goto('/for-sale/reading')
    expect(response?.status()).toBe(200)

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Homes for sale in Reading',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toContainText('Home / For sale / Reading')

    // Static, non-Postgres content (search-results-page.tsx passes
    // `area.intro` straight through, no DB read) still renders — proving
    // the shell survives independently of the Postgres-backed strip.
    await expect(
      page.getByText(/Reading's town centre puts the station/),
    ).toBeVisible()

    // The Postgres-backed "Newest in Reading" strip degrades to silently
    // absent (fetchNewestInArea's fallback) rather than taking the page
    // down with it — the one piece of this page's shell that is allowed
    // to differ from a healthy run.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Newest in Reading' }),
    ).not.toBeVisible()
  })
})

test.describe('landing page hero search box', () => {
  test('the hero shows the working search box (channel toggle, combobox, Search button)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'A property site that actually knows Reading.',
      }),
    ).toBeVisible()

    const heroForm = page
      .locator('form')
      .filter({ has: page.getByRole('group', { name: 'Buy or rent' }) })
    await expect(
      heroForm.getByRole('button', { name: 'For sale' }),
    ).toBeVisible()
    await expect(
      heroForm.getByRole('button', { name: 'To rent' }),
    ).toBeVisible()
    // Matched by placeholder rather than accessible name — the sr-only
    // `<label>` and the placeholder text differ (search-combobox.tsx), and
    // this is the one visible cue a sighted user actually reads.
    await expect(
      heroForm.getByPlaceholder('Postcode or area, e.g. Caversham or RG4'),
    ).toBeVisible()
    await expect(heroForm.getByRole('button', { name: 'Search' })).toBeVisible()
  })
})

test.describe('accessibility — public search surfaces (M2)', () => {
  test('/for-sale (whatever state the search index renders) has no automatically detectable WCAG 2.2 AA violations', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/for-sale')

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })

  test('landing page hero search box has no automatically detectable WCAG 2.2 AA violations', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })
})
