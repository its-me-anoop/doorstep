import { afterEach, describe, expect, it, vi } from 'vitest'

import { isMapFeatureEnabled } from '@/lib/feature-flags'

// PRD §8.8: "Feature flags via simple env-driven config for risky
// surfaces (map search, guest enquiry)" — a kill switch, not a
// build-time branch, so it reads `process.env` at call time rather than
// being baked in once.
describe('isMapFeatureEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is enabled by default when the env var is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_MAP', undefined)
    expect(isMapFeatureEnabled()).toBe(true)
  })

  it('is enabled for any value other than the literal string "false"', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_MAP', 'true')
    expect(isMapFeatureEnabled()).toBe(true)
  })

  it('is disabled only when explicitly set to "false" (the kill switch)', () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_MAP', 'false')
    expect(isMapFeatureEnabled()).toBe(false)
  })
})
