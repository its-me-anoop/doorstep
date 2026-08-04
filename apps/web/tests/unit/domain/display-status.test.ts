import { describe, expect, it } from 'vitest'

import { getDisplayStatus } from '@/domain/display-status'

describe('getDisplayStatus', () => {
  it('maps under_offer to "Sold STC" for sale', () => {
    expect(getDisplayStatus('under_offer', 'sale')).toBe('Sold STC')
  })

  it('maps under_offer to "Let Agreed" for rent', () => {
    expect(getDisplayStatus('under_offer', 'rent')).toBe('Let Agreed')
  })

  it('maps completed to "Sold" for sale', () => {
    expect(getDisplayStatus('completed', 'sale')).toBe('Sold')
  })

  it('maps completed to "Let" for rent', () => {
    expect(getDisplayStatus('completed', 'rent')).toBe('Let')
  })

  it.each([
    'draft',
    'pending_review',
    'rejected',
    'published',
    'hidden',
    'archived',
  ] as const)('passes through %s unchanged for either channel', (status) => {
    expect(getDisplayStatus(status, 'sale')).toBe(status)
    expect(getDisplayStatus(status, 'rent')).toBe(status)
  })
})
