/**
 * RateLimiter — fronts Upstash Redis. Used to throttle guest enquiries,
 * auth attempts and similar abuse-prone actions per PRD §7.4.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export interface RateLimiter {
  consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>
}
