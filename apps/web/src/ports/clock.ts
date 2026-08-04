/**
 * Clock — the only sanctioned way for domain/ and services/ to read the
 * current time. Keeps state-machine transitions and retention jobs
 * deterministic under test (inject a FixedClock instead of calling
 * `new Date()` or `Date.now()` directly).
 */

export interface Clock {
  now(): Date
}
