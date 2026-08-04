/**
 * The listing lifecycle state machine (PRD §9.3). This is the one place
 * transitions are decided — callers never hand-roll a status check, they
 * ask this module (OCP: new statuses/transitions extend TRANSITIONS, not
 * call sites).
 */

import type { PropertyStatus } from './enums'

const TRANSITIONS: Record<PropertyStatus, ReadonlySet<PropertyStatus>> = {
  draft: new Set(['pending_review']),
  pending_review: new Set(['published', 'rejected']),
  rejected: new Set(['pending_review']),
  published: new Set(['under_offer', 'hidden']),
  under_offer: new Set(['published', 'completed']),
  completed: new Set(['archived']),
  hidden: new Set(['published', 'archived']),
  archived: new Set(),
}

export class InvalidTransitionError extends Error {
  readonly from: PropertyStatus
  readonly to: PropertyStatus

  constructor(from: PropertyStatus, to: PropertyStatus) {
    super(`Invalid property status transition: ${from} -> ${to}`)
    this.name = 'InvalidTransitionError'
    this.from = from
    this.to = to
  }
}

export function canTransition(
  from: PropertyStatus,
  to: PropertyStatus,
): boolean {
  return TRANSITIONS[from].has(to)
}

export function assertTransition(
  from: PropertyStatus,
  to: PropertyStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to)
  }
}
