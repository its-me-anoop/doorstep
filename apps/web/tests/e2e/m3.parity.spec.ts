/**
 * m3.parity.spec.ts — the real-backend M3 map/list parity and bbox-requery
 * journeys (PRD §13's M3 exit criterion, stated verbatim: "Map and list
 * return identical results for the same criteria"). Mirrors
 * m2.search-journey.spec.ts's own gating and setup exactly — see that
 * file's header comment for the full local-stack setup (Postgres +
 * PostGIS, Meilisearch, Firebase Storage emulator, seeded + reindexed);
 * only the final run command differs:
 *
 *   BASE_URL=http://localhost:3005 RUN_LOCAL_STACK_E2E=1 npx playwright \
 *     test tests/e2e/m3.parity.spec.ts
 *
 * Two concerns, two describe blocks:
 *
 *  - "map and list return identical results" runs the same three
 *    criteria sets (channel-only; channel+price+beds; a bbox) through
 *    both `/for-sale` (list) and `/for-sale?view=map` (map) and asserts
 *    the *sets* of listing slugs are equal and the visible count line
 *    agrees — proving M3-DESIGN-SPEC's "no second query path" claim for
 *    real, against the real search API, not by reading the source.
 *    Slugs (not internal ids) are the comparison key: the same public
 *    identifier a list card's own `href="/property/{slug}"` already
 *    carries, and what map-view.tsx's `data-listing-ids` hook (added
 *    for this spec — see that file's own doc comment) publishes.
 *
 *  - "bbox requery journey" drives the *interactive* path once — pan
 *    the live map by dragging its canvas, confirm "Search this area"
 *    appears, click it, confirm the URL gains bbox params, confirm the
 *    list agrees with the post-drag map. The bbox *parity* criteria set
 *    above deliberately does not use a drag — it drives a bbox
 *    URL/query directly instead. Documented split, not an oversight:
 *    a real MapLibre drag is one real user gesture away from being
 *    exactly what a user does, but its exact resulting bbox is a
 *    function of pixel deltas, the tile viewport's aspect ratio and
 *    OpenFreeMap's real (network-dependent) tile load timing — fine for
 *    proving the *mechanism* once, too imprecise/slow to build three
 *    repeatable parity fixtures on. Driving the URL directly for parity
 *    keeps those three cases deterministic and fast; this journey test
 *    is what actually proves a real drag reaches the same mechanism.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.skip(
  process.env.RUN_LOCAL_STACK_E2E !== '1',
  'Set RUN_LOCAL_STACK_E2E=1 (plus BASE_URL pointing at a local server backed by a real, seeded+reindexed Postgres, Meilisearch and Firebase Storage emulator) to run the real-backend M3 map/list parity and bbox-requery journeys — see this file’s own header comment for the exact setup.',
)

/** Every result card is `<a href="/property/{slug}">` (result-card.tsx,
 * reused verbatim from m2.search-journey.spec.ts's own helper) — read
 * back here as the slug itself, the same identifier the map's
 * `data-listing-ids` hook below publishes, so the two sides need no
 * id/slug translation to compare. */
function resultCards(page: Page) {
  return page.locator('a[href^="/property/"]')
}

async function listSlugs(page: Page): Promise<string[]> {
  const hrefs = await resultCards(page).evaluateAll((anchors) =>
    anchors.map((a) => a.getAttribute('href')),
  )
  return hrefs
    .filter((href): href is string => href !== null)
    .map((href) => href.replace('/property/', ''))
    .sort()
}

/** Reads map-view.tsx's own `data-listing-ids` e2e hook — see that
 * file's doc comment for why this, not driving a real cluster-expand
 * click per pin, is the stable way to read "what listing set backs the
 * map right now" from outside. */
async function mapSlugs(page: Page): Promise<string[]> {
  const raw = await page
    .getByTestId('map-view')
    .getAttribute('data-listing-ids')
  return (JSON.parse(raw ?? '[]') as string[]).sort()
}

/** The `<p aria-live="polite">{n} homes...</p>` count line
 * (results-view.tsx) — visible in both list and map view on desktop
 * (only mobile's map view hides the header row it lives in), so this
 * one helper works for both sides of every criteria set below. */
async function resultCountNumber(page: Page): Promise<number> {
  const text = await page
    .locator('p[aria-live="polite"]')
    .first()
    .locator('span')
    .first()
    .innerText()
  const match = /^(\d+)/.exec(text)
  if (!match) throw new Error(`Could not parse a result count from "${text}"`)
  return Number(match[1])
}

interface CriteriaSet {
  name: string
  /** Query string with no leading `?`, or `''` for channel-only. */
  query: string
}

// Confirmed against the real seeded+reindexed local stack before writing
// these assertions (curl against GET /api/v1/search directly): 10 results
// unfiltered, 7 with this price+beds combination, 3 inside this bbox —
// each a genuine, non-trivial subset, so a regression that made map and
// list disagree on *which* subset would be caught, not just "both
// non-empty."
const CRITERIA_SETS: CriteriaSet[] = [
  { name: 'channel-only', query: '' },
  {
    name: 'channel + price + beds filters',
    query: 'minPrice=400000&minBeds=3',
  },
  {
    name: 'a bbox (driven via URL — see this file’s header comment)',
    query: 'bboxNeLat=51.50&bboxNeLng=-0.90&bboxSwLat=51.44&bboxSwLng=-0.99',
  },
]

test.describe('map and list return identical results for the same criteria (PRD §13)', () => {
  for (const { name, query } of CRITERIA_SETS) {
    test(`${name}: list and map show the same listing set and count`, async ({
      page,
    }) => {
      test.setTimeout(30_000)

      const listUrl = query ? `/for-sale?${query}` : '/for-sale'
      const mapUrl = `${listUrl}${query ? '&' : '?'}view=map`

      await test.step('list view — collect ids and count', async () => {
        await page.goto(listUrl)
        await expect(resultCards(page).first()).toBeVisible()
      })
      const idsFromList = await listSlugs(page)
      const countFromList = await resultCountNumber(page)
      expect(idsFromList.length).toBeGreaterThan(0)

      await test.step('map view, same criteria — collect ids and count', async () => {
        await page.goto(mapUrl)
        await expect(page.getByTestId('map-view')).toBeVisible()
      })
      // The map chunk loads asynchronously (next/dynamic ssr:false) —
      // poll rather than a single read so this doesn't race the "Loading
      // map…" placeholder swapping in the real MapView.
      await expect
        .poll(async () => (await mapSlugs(page)).length, {
          message: 'waiting for the map’s data-listing-ids to settle',
          timeout: 10_000,
        })
        .toBe(idsFromList.length)
      const idsFromMap = await mapSlugs(page)
      const countFromMap = await resultCountNumber(page)

      expect(idsFromMap).toEqual(idsFromList)
      expect(countFromMap).toBe(countFromList)
    })
  }
})

test.describe('bbox requery journey — search-as-I-move OFF path', () => {
  test('panning the map, then "Search this area", puts a bbox in the URL and the list agrees with the post-pan map', async ({
    page,
  }) => {
    test.setTimeout(45_000)

    await test.step('open the map view', async () => {
      await page.goto('/for-sale?view=map')
      await expect(page.getByTestId('map-view')).toBeVisible()
    })

    // §1.5 default: off. Asserted, not just assumed, since the whole
    // point of this journey is the OFF path's manual "Search this area"
    // step (the auto-requery ON path is covered at the unit level,
    // use-search-as-you-move.test.ts).
    await expect(
      page.getByRole('checkbox', { name: 'Search as I move the map' }),
    ).not.toBeChecked()
    await expect(
      page.getByRole('button', { name: 'Search this area' }),
    ).not.toBeVisible()

    const canvasContainer = page.locator('.map-canvas-container')
    await expect(canvasContainer).toBeVisible()
    const box = await canvasContainer.boundingBox()
    if (!box) throw new Error('Map canvas container has no bounding box')
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    await test.step('drag the map — a real user gesture, not a programmatic camera move', async () => {
      await page.mouse.move(centerX, centerY)
      await page.mouse.down()
      // Several intermediate moves, not one jump: MapLibre/Mapbox both
      // need more than a single mousemove sample to recognise a drag
      // gesture rather than a click.
      await page.mouse.move(centerX - 60, centerY - 40, { steps: 10 })
      await page.mouse.move(centerX - 120, centerY - 80, { steps: 10 })
      await page.mouse.up()
    })

    await expect(
      page.getByRole('button', { name: 'Search this area' }),
    ).toBeVisible({ timeout: 10_000 })

    await test.step('click "Search this area" — the URL gains bbox params', async () => {
      await page.getByRole('button', { name: 'Search this area' }).click()
      await expect(page).toHaveURL(/[?&]bboxNeLat=/)
      await expect(page).toHaveURL(/[?&]bboxNeLng=/)
      await expect(page).toHaveURL(/[?&]bboxSwLat=/)
      await expect(page).toHaveURL(/[?&]bboxSwLng=/)
    })

    // The URL updates synchronously (router.replace), but the bbox
    // requery's own fetch is async (results-view.tsx's effect,
    // surfaced here via its "Updating results…" live region) — wait for
    // it to clear rather than reading `data-listing-ids` mid-fetch.
    await expect(page.getByText('Updating results…')).not.toBeVisible({
      timeout: 10_000,
    })
    const idsFromMapAfterDrag = await mapSlugs(page)

    await test.step('toggle to list — it shows the same post-drag bbox result set', async () => {
      await page.getByRole('button', { name: 'List' }).click()
      await expect(page).not.toHaveURL(/[?&]view=map\b/)
      await expect(page).toHaveURL(/[?&]bboxNeLat=/)

      if (idsFromMapAfterDrag.length > 0) {
        await expect(resultCards(page).first()).toBeVisible()
      }
      const idsFromListAfterDrag = await listSlugs(page)
      expect(idsFromListAfterDrag).toEqual(idsFromMapAfterDrag)
    })
  })
})

test.describe('accessibility — map view with real, seeded pins (M3)', () => {
  // The half of "the aria-hidden pin strategy has zero violations"
  // (§4: pin-marker.ts/cluster-marker.ts) that m3.smoke.spec.ts's
  // placeholder/no-live-search environment structurally cannot exercise
  // — that file's own axe scans cover the pin-less shell; these cover
  // the real thing, real pins mounted on a real map, at both viewports
  // §0 specifies.
  test('map view with real pins (desktop) has no automatically detectable WCAG 2.2 AA violations', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/for-sale?view=map')
    await expect(resultCards(page).first()).toBeVisible()
    await expect
      .poll(async () => (await mapSlugs(page)).length, {
        message: 'waiting for real pins to sync onto the map',
        timeout: 10_000,
      })
      .toBeGreaterThan(0)

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })

  test('map view with real pins (mobile) has no automatically detectable WCAG 2.2 AA violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/for-sale?view=map')
    // `data-listing-ids` is read via `getAttribute`, not a visibility
    // check — the map view's own root is a flex container whose real,
    // on-screen content is all `position: fixed` (map-view.tsx's mobile
    // pane), so its own box collapses to zero height on a narrow
    // viewport even once fully rendered; polling this attribute is both
    // the readiness wait and unaffected by that collapse.
    await expect
      .poll(async () => (await mapSlugs(page)).length, {
        message: 'waiting for real pins to sync onto the map',
        timeout: 10_000,
      })
      .toBeGreaterThan(0)

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })
})
