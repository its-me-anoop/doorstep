/**
 * lib/composition.ts — the composition root.
 *
 * This is the one place allowed to import concrete adapters (adapters/*)
 * and wire them into ports (ports/), then hand the resulting services
 * (services/) to callers. Route handlers and server components call
 * `createServices()` and depend on the returned shape, never on an
 * adapter directly (DIP). The ESLint config in this package enforces
 * that boundary: app/** may not import from adapters/** except through
 * this file.
 *
 * `auth` is the first group of services wired here (EstablishSession,
 * TerminateSession, GetCurrentUser — PRD §8.4). Later milestones add a
 * concrete adapter per port here as each remaining integration
 * (Meilisearch, Storage, Resend, Mapbox, Upstash) lands. See PRD §8.5.
 *
 * Note: this constructs a DrizzleUserRepository, which calls
 * adapters/drizzle/client.ts's getDb() — that throws if DATABASE_URL
 * isn't set. That's expected: createServices() is meant to be called at
 * request time (inside a route handler or server component), by which
 * point the environment is configured, not at module-import time or in
 * a unit test — see tests/unit/ports/barrel.test.ts for how tests that
 * merely need createServices() to construct without a live database
 * satisfy that.
 */

import { getDb } from '@/adapters/drizzle/client'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import { FirebaseAuthGateway } from '@/adapters/firebase'
import { SystemClock } from '@/adapters/system-clock'
import {
  EstablishSession,
  GetCurrentUser,
  TerminateSession,
} from '@/services/auth'

export interface AuthServices {
  establishSession: EstablishSession
  terminateSession: TerminateSession
  getCurrentUser: GetCurrentUser
}

export interface Services {
  auth: AuthServices
}

export function createServices(): Services {
  const userRepository = new DrizzleUserRepository(getDb())
  const authGateway = new FirebaseAuthGateway()
  const clock = new SystemClock()

  return {
    auth: {
      establishSession: new EstablishSession(
        authGateway,
        userRepository,
        clock,
      ),
      terminateSession: new TerminateSession(authGateway),
      getCurrentUser: new GetCurrentUser(authGateway, userRepository, clock),
    },
  }
}
