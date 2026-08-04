import type { Metadata } from 'next'

import { ForAgentsSection } from '@/components/features/landing/for-agents-section'
import { HeroSection } from '@/components/features/landing/hero-section'
import { ReadingFocusSection } from '@/components/features/landing/reading-focus-section'
import { ValuePropositionSection } from '@/components/features/landing/value-proposition-section'

export const metadata: Metadata = {
  title: 'A property site that actually knows Reading',
}

/**
 * M0 landing page (DESIGN-SPEC.md §3). No search UI exists yet — the
 * page's three jobs are to explain what Doorstep is, prove the
 * Reading-first positioning is real strategy, and convert to sign-up.
 * No hero-metric template, no icon-card grid, nothing centred except
 * the CTA.
 */
export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ValuePropositionSection />
      <ReadingFocusSection />
      <ForAgentsSection />
    </>
  )
}
