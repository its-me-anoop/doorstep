/**
 * m4.smoke.spec.ts — CI-safe M4/M6 legal-page coverage: privacy, terms,
 * cookies and complaints render with a visible h1 and pass axe (same pattern
 * as m3.smoke.spec.ts — no live stack required).
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const LEGAL_PAGES = [
  { path: '/privacy', title: 'Privacy policy' },
  { path: '/terms', title: 'Terms of use' },
  { path: '/cookies', title: 'Cookie policy' },
  { path: '/complaints', title: 'Complaints' },
] as const

for (const { path, title } of LEGAL_PAGES) {
  test.describe(`${path}`, () => {
    test('renders h1 and has no automatically detectable WCAG 2.2 AA violations', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)

      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
      expect(results.violations).toEqual([])
    })
  })
}
