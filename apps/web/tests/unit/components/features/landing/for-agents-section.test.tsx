import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ForAgentsSection } from '@/components/features/landing/for-agents-section'

describe('ForAgentsSection', () => {
  it('points its CTA at /onboarding (PRD §6.5 LST-1 entry point)', () => {
    render(<ForAgentsSection />)

    const cta = screen.getByRole('button', { name: /list with doorstep/i })
    expect(cta).toHaveAttribute('href', '/onboarding')
  })
})
