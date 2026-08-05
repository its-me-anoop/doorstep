import { describe, expect, it } from 'vitest'

import {
  ACTION_TARGET_STATUS,
  actionButtonLabel,
  actionPastTenseLabel,
  inverseAction,
} from '@/components/features/listings/dashboard/listing-status-actions'

// M1-DESIGN-SPEC.md §4.3/§4.4: the client-side mirror of
// services/listings/change-listing-status.ts's private ACTION_TARGET_STATUS
// map, needed so the dashboard can paint the new badge optimistically
// before the real POST /status response arrives. Deliberately duplicated
// rather than imported from the service (that file is server-only and,
// per lib/validation/listing.ts's own changeListingStatusSchema doc
// comment, this codebase already accepts a literal duplicate over a
// shared runtime source for this exact union).
describe('listing-status-actions', () => {
  describe('ACTION_TARGET_STATUS', () => {
    it('mirrors every action to its target status', () => {
      expect(ACTION_TARGET_STATUS).toEqual({
        sold_stc: 'under_offer',
        let_agreed: 'under_offer',
        complete: 'completed',
        hide: 'hidden',
        unhide: 'published',
        back_on_market: 'published',
      })
    })
  })

  describe('inverseAction', () => {
    it('returns back_on_market as the inverse of sold_stc', () => {
      expect(inverseAction('sold_stc')).toBe('back_on_market')
    })

    it('returns back_on_market as the inverse of let_agreed', () => {
      expect(inverseAction('let_agreed')).toBe('back_on_market')
    })

    it('returns unhide as the inverse of hide', () => {
      expect(inverseAction('hide')).toBe('unhide')
    })

    it('has no inverse for complete — completed only ever transitions to archived', () => {
      expect(inverseAction('complete')).toBeNull()
    })

    it('has no inverse for the already-reversible actions themselves', () => {
      expect(inverseAction('unhide')).toBeNull()
      expect(inverseAction('back_on_market')).toBeNull()
    })
  })

  describe('actionButtonLabel', () => {
    it('labels sold_stc for a sale listing', () => {
      expect(actionButtonLabel('sold_stc', 'sale')).toBe('Mark Sold STC')
    })

    it('labels let_agreed for a rent listing', () => {
      expect(actionButtonLabel('let_agreed', 'rent')).toBe('Mark Let Agreed')
    })

    it('labels complete as Mark Sold for a sale listing', () => {
      expect(actionButtonLabel('complete', 'sale')).toBe('Mark Sold')
    })

    it('labels complete as Mark Let for a rent listing', () => {
      expect(actionButtonLabel('complete', 'rent')).toBe('Mark Let')
    })

    it('labels hide, unhide and back_on_market the same regardless of channel', () => {
      expect(actionButtonLabel('hide', 'sale')).toBe('Hide')
      expect(actionButtonLabel('unhide', 'rent')).toBe('Unhide')
      expect(actionButtonLabel('back_on_market', 'sale')).toBe('Back on market')
    })
  })

  describe('actionPastTenseLabel', () => {
    it('describes hide as removed from search', () => {
      expect(actionPastTenseLabel('hide', 'sale')).toBe('Hidden from search.')
    })

    it('describes sold_stc/let_agreed by channel', () => {
      expect(actionPastTenseLabel('sold_stc', 'sale')).toBe('Marked Sold STC.')
      expect(actionPastTenseLabel('let_agreed', 'rent')).toBe(
        'Marked Let Agreed.',
      )
    })

    it('describes complete by channel', () => {
      expect(actionPastTenseLabel('complete', 'sale')).toBe('Marked sold.')
      expect(actionPastTenseLabel('complete', 'rent')).toBe('Marked let.')
    })

    it('describes unhide and back_on_market', () => {
      expect(actionPastTenseLabel('unhide', 'sale')).toBe('Unhidden.')
      expect(actionPastTenseLabel('back_on_market', 'sale')).toBe(
        'Back on the market.',
      )
    })
  })
})
