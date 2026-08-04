/**
 * a11y.spec.ts — automated axe accessibility checks (PRD §7.3: "WCAG 2.2
 * AA ... automated axe checks inside e2e suites"). Zero violations is the
 * bar; a violation found here gets the UI fixed, not the rule excluded.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const PAGES = ['/', '/sign-in', '/sign-up']

for (const path of PAGES) {
  test(`${path} has no automatically detectable WCAG 2.2 AA violations`, async ({
    page,
  }) => {
    // The landing page's once-on-load hero entrance animation
    // (globals.css's .hero-enter, honouring prefers-reduced-motion per PRD
    // §7.3/impeccable.style) fades elements in with staggered delays.
    // Scanning mid-fade makes axe measure a blended, transiently
    // low-contrast colour against a fully-opaque background — a
    // scan-timing artefact, not a real contrast defect a user would ever
    // see. Emulating reduced motion before navigating is the same code
    // path the app already ships for real users with that OS preference,
    // so axe gets a settled, representative DOM. (Set via
    // page.emulateMedia rather than test.use({ reducedMotion }) — the
    // latter does not reliably apply before the very first navigation on
    // this Playwright version.)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(path)

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

    expect(results.violations).toEqual([])
  })
}
