import { describe, expect, it } from 'vitest'

import { SystemClock } from '@/adapters/system-clock'

describe('SystemClock', () => {
  it('returns the current wall-clock time', () => {
    const before = Date.now()
    const now = new SystemClock().now()
    const after = Date.now()

    expect(now.getTime()).toBeGreaterThanOrEqual(before)
    expect(now.getTime()).toBeLessThanOrEqual(after)
  })
})
