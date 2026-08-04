/**
 * SystemClock — the real Clock (ports/clock.ts) implementation, wired at
 * the composition root for anything that isn't a unit test. Unit tests
 * inject a fake clock instead (see tests/unit/services/auth/fakes.ts's
 * FakeClock) so time-dependent logic like sliding renewal stays
 * deterministic. See PRD §8.5.
 */

import type { Clock } from '@/ports/clock'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
