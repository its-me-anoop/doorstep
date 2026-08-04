/**
 * TerminateSession — the use case behind DELETE /api/v1/auth/session.
 * Revokes every Firebase refresh token for the cookie's uid so the
 * server side is invalidated too, not just the browser's cookie (PRD
 * §8.4). Signing out twice, or with a missing/stale cookie, is a no-op —
 * not an error the caller has to handle.
 */

import type { AuthGateway } from '@/ports/auth-gateway'

export class TerminateSession {
  constructor(private readonly authGateway: AuthGateway) {}

  async execute(sessionCookie: string | null): Promise<void> {
    if (!sessionCookie) return

    let uid: string
    try {
      uid = (await this.authGateway.verifySessionCookie(sessionCookie)).uid
    } catch {
      return
    }

    await this.authGateway.revokeSessions(uid)
  }
}
