/**
 * m2.search-journey.spec.ts — the real-backend M2 search journeys (PRD
 * §6.1 SRCH-1..4/SRCH-7, §7.2, §7.3, §8.3's "the single critical journey:
 * search -> results -> detail"). Mirrors m1.full-journey.spec.ts's own
 * pattern exactly: everything else in the e2e suite runs against
 * placeholder Firebase/no-DB/no-Meilisearch config (enough for gating and
 * degradation, PRD §7.6 — see m2.smoke.spec.ts), which cannot complete a
 * real postcodes.io lookup, a real Meilisearch query, or a real Postgres
 * read. This spec is the exception — RUN_LOCAL_STACK_E2E=1 is this file's
 * own new gating convention (parallel to full-auth.spec.ts's
 * E2E_TEST_EMAIL/PASSWORD gate), since unlike that file's "real
 * credentials on a shared project" requirement, what this needs is a
 * *local* stack: real Postgres, real Meilisearch, real (emulated)
 * Firebase Storage, seeded and reindexed.
 *
 * To run, from apps/web:
 *
 *   1. Postgres up (see this repo's CLAUDE.md for the exact local start
 *      command) and migrated + seeded: `pnpm seed`.
 *   2. Meilisearch up locally (this repo's CLAUDE.md's exact start
 *      command — MEILISEARCH_HOST/MEILISEARCH_API_KEY in .env.local
 *      already point at it).
 *   3. Firebase Storage emulator up: `firebase emulators:start --only
 *      storage --project my-shop-cdeac` (firebase.json at the repo
 *      root) — needed because scripts/seed.ts's property_images rows
 *      were never run through the real upload pipeline, so no bytes
 *      exist yet at the paths the search index/detail page read images
 *      from (see scripts/backfill-storage-emulator.ts's own header
 *      comment for the full story — a pre-existing gap
 *      scripts/seed-search-5k.ts's own header comment already names).
 *   4. Backfill placeholder image bytes for the seeded listings:
 *      `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 pnpm
 *      backfill:storage-emulator`.
 *   5. Reindex Meilisearch from Postgres: `FIREBASE_STORAGE_EMULATOR_HOST=
 *      127.0.0.1:9199 pnpm reindex:local` (a thin local wrapper around
 *      the same RebuildSearchIndex GET /api/cron/reindex calls — see
 *      scripts/reindex-local.ts's own header comment for why the emulator
 *      var is required here too).
 *   6. Build and start the app with real env plus the same emulator var:
 *      `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 pnpm build &&
 *      FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 npx next start -p
 *      3005` (3005 — 3000/3001/3007 are reserved, see this repo's
 *      CLAUDE.md).
 *   7. `BASE_URL=http://localhost:3005 RUN_LOCAL_STACK_E2E=1 npx
 *      playwright test tests/e2e/m2.search-journey.spec.ts`.
 *
 * Two journeys, not one continuous script: the task brief this spec was
 * written against assumed typing "RG1" and picking its postcode
 * suggestion would land on the generic `/for-sale/search` (point/radius)
 * tier. Running it for real against postcodes.io shows otherwise —
 * `RG1`'s admin_district is "Reading," which exactly matches the curated
 * Reading area's label (lib/curated-areas.ts's `matchCuratedArea`,
 * M2-DESIGN-SPEC.md §1.9's own documented rule: an exact curated-area
 * match routes to the richer area landing page, not `/search`). That's
 * correct, spec'd behaviour, not a bug — so the guided-search journey
 * below asserts the real destination (`/for-sale/reading`) instead of
 * forcing an artificial one, and doubles as this suite's area-page
 * coverage with real SSR data. The filter/sort/channel/pagination/detail
 * mechanics the brief wanted proven live on the unrestricted `/for-sale`
 * tier instead, which the fixed seed data (scripts/seed-data.ts) spreads
 * across a wide enough price range to make "narrowed" and "cheapest
 * first" assertions meaningful — a single curated area has as few as one
 * matching listing, too sparse to demonstrate narrowing at all.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  expect(results.violations).toEqual([])
}

/** Every result card is a `<a href="/property/{slug}">` wrapping the
 * whole tile (result-card.tsx) — the one stable, implementation-light
 * selector for "how many cards are on screen right now" and "what does
 * card N say," reused by every step below rather than each inventing its
 * own. */
function resultCards(page: Page) {
  return page.locator('a[href^="/property/"]')
}

async function cardPriceText(page: Page, index: number): Promise<string> {
  return resultCards(page).nth(index).locator('p').first().innerText()
}

function priceDigits(priceText: string): number {
  return Number(priceText.replace(/[^0-9]/g, ''))
}

test.skip(
  process.env.RUN_LOCAL_STACK_E2E !== '1',
  'Set RUN_LOCAL_STACK_E2E=1 (plus BASE_URL pointing at a local server backed by a real, seeded+reindexed Postgres, Meilisearch and Firebase Storage emulator) to run the real-backend M2 search journeys — see this file’s own header comment for the exact setup.',
)

test.describe('guided search from the landing page', () => {
  test('typing a Reading postcode and picking its suggestion lands on the curated Reading area page with real SSR results', async ({
    page,
  }) => {
    test.setTimeout(45_000)

    await page.emulateMedia({ reducedMotion: 'reduce' })

    await test.step('landing page: type RG1 into the hero combobox', async () => {
      await page.goto('/')
      const combobox = page.getByPlaceholder(
        'Postcode or area, e.g. Caversham or RG4',
      )
      await combobox.click()
      await combobox.fill('RG1')

      // Real postcodes.io network round trip behind a 250ms debounce
      // (search-combobox.tsx) — slower and less deterministic than any
      // mocked suggestion, hence the generous timeout (matches
      // m1.full-journey.spec.ts's own real-postcodes.io waits).
      await expect(
        page.getByRole('listbox', { name: 'Location suggestions' }),
      ).toBeVisible({ timeout: 15_000 })
    })

    await test.step('pick the postcode suggestion — lands on /for-sale/reading, not /for-sale/search', async () => {
      // RG1's admin_district resolves to "Reading" (postcodes.io), which
      // exactly matches the curated area's label — see this file's own
      // header comment for why this, not `/for-sale/search`, is the
      // correct destination.
      await page.getByRole('option', { name: /Reading/ }).click()
      await expect(page).toHaveURL('/for-sale/reading')
    })

    await test.step('the area page renders with real SSR results', async () => {
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Homes for sale in Reading',
        }),
      ).toBeVisible()
      await expect(
        page.getByRole('navigation', { name: 'Breadcrumb' }),
      ).toContainText('Home / For sale / Reading')

      // Real data, not a mock: at least one real result card renders,
      // each linking to a real `/property/{slug}`.
      await expect(resultCards(page).first()).toBeVisible()
    })

    await test.step('axe — area page with real data', async () => {
      await expectNoAxeViolations(page)
    })
  })
})

test.describe('filter, sort, channel switch, pagination and detail — unrestricted tier', () => {
  test('filtering, sorting and switching channel narrow and reorder real results, and a result opens through to a matching detail page', async ({
    page,
  }) => {
    test.setTimeout(45_000)

    await test.step('start on /for-sale with real SSR results', async () => {
      await page.goto('/for-sale')
      await expect(resultCards(page).first()).toBeVisible()
    })

    const beforeFilterCount = await resultCards(page).count()

    await test.step('apply a price filter via the Price popover — URL param + narrowed count', async () => {
      await page.getByRole('button', { name: 'Price' }).click()
      const panel = page.getByRole('dialog', { name: 'Price filter' })
      await panel.getByLabel('Max price').selectOption('450000')
      await panel.getByRole('button', { name: 'Apply' }).click()

      await expect(page).toHaveURL(/[?&]maxPrice=450000\b/)
      await expect
        .poll(() => resultCards(page).count(), {
          message: 'waiting for the filtered re-query to land',
          timeout: 10_000,
        })
        .toBeLessThan(beforeFilterCount)

      const afterFilterCount = await resultCards(page).count()
      expect(afterFilterCount).toBeGreaterThan(0)
    })

    await test.step('switch channel to rent — price filter resets per the channel-switch rule', async () => {
      await page.getByRole('button', { name: 'To rent' }).click()

      await expect(page).toHaveURL('/to-rent')
      await expect(page).not.toHaveURL(/maxPrice/)
      await expect(resultCards(page).first()).toBeVisible()
    })

    await test.step('sort by price ascending — the first card is the cheapest', async () => {
      await page.getByLabel('Sort').selectOption('price_asc')
      await expect(page).toHaveURL(/[?&]sort=price_asc\b/)

      // The URL updates synchronously (router.replace), but the re-query
      // and re-render are async (results-view.tsx's effect) — polling
      // rather than a single read avoids reading the grid mid-transition,
      // part sorted-order, part stale "Newest first" order.
      const isFullySortedAscending = async () => {
        const count = await resultCards(page).count()
        if (count <= 1) return false
        const prices: number[] = []
        for (let i = 0; i < count; i += 1) {
          prices.push(priceDigits(await cardPriceText(page, i)))
        }
        return prices.every((price, i) => i === 0 || price >= prices[i - 1])
      }
      await expect
        .poll(isFullySortedAscending, {
          message: 'waiting for the results to finish re-sorting ascending',
          timeout: 10_000,
        })
        .toBe(true)
    })

    // Captured now, right after the sort step's own poll has already
    // proven the grid settled into its final ascending order — not after
    // the pagination step below, which (when it runs at all) briefly
    // navigates away to page 2 and back, an extra async round trip this
    // capture has no reason to race against.
    const cheapestCardPrice = await cardPriceText(page, 0)
    const cheapestCardAddress = await resultCards(page)
      .nth(0)
      .locator('p')
      .nth(1)
      .innerText()
    const resultsPageUrl = page.url()

    await test.step('pagination — only if the sorted result set spans more than one page', async () => {
      const pagination = page.getByRole('navigation', {
        name: 'Search results pages',
      })
      if (await pagination.isVisible().catch(() => false)) {
        const firstCardHrefBefore = await resultCards(page)
          .first()
          .getAttribute('href')

        await pagination.getByRole('link', { name: '2', exact: true }).click()
        await expect(page).toHaveURL(/[?&]page=2\b/)

        // As above: the URL updates before the re-query resolves, so
        // poll rather than read once.
        await expect
          .poll(() => resultCards(page).first().getAttribute('href'), {
            message: 'waiting for page 2’s results to render',
            timeout: 10_000,
          })
          .not.toBe(firstCardHrefBefore)

        // Back to page 1 via the pagination control itself, not the
        // browser's back button: every filter/sort/page change on this
        // page navigates via `router.replace` (results-view.tsx's
        // `navigate`), which overwrites the current history entry rather
        // than pushing a new one — by design, so a filter tweak doesn't
        // bloat the back-button stack (§3.7). That means there is no
        // separate "page 1" history entry to go back to here; "Prev" is
        // the real, only way back to it.
        await page
          .getByRole('navigation', { name: 'Search results pages' })
          .getByRole('link', { name: 'Prev' })
          .click()
        await expect(page).not.toHaveURL(/[?&]page=2\b/)
      } else {
        // Documented, not silently skipped: the fixed seed data (~8
        // rent listings) is smaller than the 24-per-page default
        // (adapters/meilisearch's DEFAULT_HITS_PER_PAGE), so pagination
        // has nothing to exercise here yet. Asserting its absence means
        // a future reseed that crosses that threshold is noticed, not
        // silently ignored.
        await expect(pagination).toHaveCount(0)
      }
    })

    await test.step('axe — results page with real, sorted data', async () => {
      await expectNoAxeViolations(page)
    })

    await test.step('open the cheapest result — its detail page renders matching facts and a breadcrumb', async () => {
      await resultCards(page).first().click()
      await expect(page).toHaveURL(/\/property\/[^/]+$/)

      await expect(
        page.getByRole('navigation', { name: 'Breadcrumb' }),
      ).toContainText('Home / To rent')

      // The same price and address the card advertised, now the detail
      // page's own key facts / location section — proves this is the
      // same listing, not just "a" detail page.
      await expect(
        page.getByRole('definition').filter({ hasText: cheapestCardPrice }),
      ).toBeVisible()
      await expect(
        page.getByText(cheapestCardAddress, { exact: true }),
      ).toBeVisible()

      // Bedrooms/bathrooms/type are always present (key-facts.tsx),
      // regardless of which specific listing this ended up being.
      await expect(page.getByText('Bedrooms', { exact: true })).toBeVisible()
      await expect(page.getByText('Bathrooms', { exact: true })).toBeVisible()
    })

    await test.step('axe — detail page', async () => {
      await expectNoAxeViolations(page)
    })

    await test.step('back preserves the results page’s filter/sort/channel URL state', async () => {
      await page.goBack()
      await expect(page).toHaveURL(resultsPageUrl)
      await expect(resultCards(page).first()).toBeVisible()
    })
  })
})
