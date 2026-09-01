/**
 * adapters/upstash/ — RateLimiter via Upstash Redis (PRD §7.4).
 *
 * When UPSTASH_REDIS_REST_URL / TOKEN are unset, falls back to an
 * in-process sliding-window map so local/CI enquiry spam controls still
 * work. The in-memory path is per-instance only (fine for one-dev / one
 * CI runner; not for multi-instance production — set Upstash there).
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import type { Clock } from '@/ports/clock'
import type { RateLimitResult, RateLimiter } from '@/ports/rate-limiter'

interface WindowEntry {
  timestamps: number[]
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, WindowEntry>()

  constructor(private readonly clock: Clock) {}

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const now = this.clock.now().getTime()
    const windowMs = windowSeconds * 1000
    const entry = this.windows.get(key) ?? { timestamps: [] }
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)
    if (entry.timestamps.length >= limit) {
      const oldest = entry.timestamps[0] ?? now
      this.windows.set(key, entry)
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(oldest + windowMs),
      }
    }
    entry.timestamps.push(now)
    this.windows.set(key, entry)
    return {
      allowed: true,
      remaining: Math.max(0, limit - entry.timestamps.length),
      resetAt: new Date(now + windowMs),
    }
  }
}

export class UpstashRateLimiter implements RateLimiter {
  private readonly redis: Redis
  private readonly limiters = new Map<string, Ratelimit>()

  constructor(
    url: string = process.env.UPSTASH_REDIS_REST_URL ?? '',
    token: string = process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  ) {
    if (!url || !token) {
      throw new Error(
        'UpstashRateLimiter requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
      )
    }
    this.redis = new Redis({ url, token })
  }

  private limiterFor(limit: number, windowSeconds: number): Ratelimit {
    const cacheKey = `${limit}:${windowSeconds}`
    let limiter = this.limiters.get(cacheKey)
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        prefix: 'doorstep:rl',
      })
      this.limiters.set(cacheKey, limiter)
    }
    return limiter
  }

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const result = await this.limiterFor(limit, windowSeconds).limit(key)
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: new Date(result.reset),
    }
  }
}

export function createRateLimiter(clock: Clock): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return new UpstashRateLimiter(url, token)
  return new InMemoryRateLimiter(clock)
}
