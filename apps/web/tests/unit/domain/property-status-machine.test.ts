import { describe, expect, it } from 'vitest'

import type { PropertyStatus } from '@/domain/enums'
import {
  InvalidTransitionError,
  assertTransition,
  canTransition,
} from '@/domain/property-status-machine'

// Exhaustive 8x8 grid per PRD §9.3. Every valid transition is listed here;
// every other (from, to) pair — including every self-transition — must be
// invalid. This is the mechanical backstop that keeps the state machine as
// the single place transitions are decided (OCP: extend this table, not
// call sites).
const ALL_STATUSES: PropertyStatus[] = [
  'draft',
  'pending_review',
  'rejected',
  'published',
  'under_offer',
  'completed',
  'hidden',
  'archived',
]

const VALID_TRANSITIONS: Array<[PropertyStatus, PropertyStatus]> = [
  ['draft', 'pending_review'],
  ['pending_review', 'published'],
  ['pending_review', 'rejected'],
  ['rejected', 'pending_review'],
  ['published', 'under_offer'],
  ['under_offer', 'published'],
  ['under_offer', 'completed'],
  ['published', 'hidden'],
  ['hidden', 'published'],
  ['completed', 'archived'],
  ['hidden', 'archived'],
]

function isValidPair(from: PropertyStatus, to: PropertyStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

describe('canTransition', () => {
  it.each(VALID_TRANSITIONS)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  // Exhaustively assert every one of the 64 (from, to) pairs.
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const expected = isValidPair(from, to)
      it(`${from} -> ${to} is ${expected ? 'valid' : 'invalid'}`, () => {
        expect(canTransition(from, to)).toBe(expected)
      })
    }
  }
})

describe('assertTransition', () => {
  it.each(VALID_TRANSITIONS)('does not throw for %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow()
  })

  it('throws InvalidTransitionError for an invalid pair', () => {
    expect(() => assertTransition('draft', 'published')).toThrow(
      InvalidTransitionError,
    )
  })

  it('throws for a self-transition', () => {
    expect(() => assertTransition('draft', 'draft')).toThrow(
      InvalidTransitionError,
    )
  })

  it('error carries the from/to statuses', () => {
    try {
      assertTransition('archived', 'draft')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError)
      expect((error as InvalidTransitionError).from).toBe('archived')
      expect((error as InvalidTransitionError).to).toBe('draft')
      expect((error as Error).message).toContain('archived')
      expect((error as Error).message).toContain('draft')
    }
  })
})
