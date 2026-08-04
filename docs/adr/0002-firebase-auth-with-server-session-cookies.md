# ADR-0002: Firebase Auth with server-side session cookies

## Status

Accepted — M0.

## Context

PRD §8.1 locks Firebase Auth (email/password, Google, Apple) as the identity
provider, chosen for familiarity and a generous free tier. PRD §7.4 requires:
ID tokens exchanged for HTTP-only, Secure, `SameSite=Lax` session cookies;
server-side verification via the Firebase Admin SDK; role and agency claims
in custom claims, re-checked server-side on every mutation, never trusted
from the client. Admin accounts additionally require MFA (Firebase
multi-factor). PRD §13 M0's exit criterion is explicit: "Sign up, sign in,
sign out on prod URL" must be demonstrable on production infrastructure.

Firebase ID tokens are short-lived (~1 hour) and are not designed to be
attached to every server request from a browser — doing so would require
either shipping token-refresh logic to every client surface or accepting
silent expiry failures, and it puts a bearer credential on the wire (and
potentially in logs) on every request.

## Decision

Implement a token-exchange flow:

1. Client authenticates with the Firebase JS SDK (email/password, Google,
   or Apple) and receives a short-lived ID token.
2. Client POSTs the ID token once to `/api/v1/auth/session`.
3. The route handler verifies the token with the Firebase Admin SDK,
   reads custom claims (`role`, `agencyId`), and issues an HTTP-only,
   Secure, `SameSite=Lax` session cookie with a 14-day sliding expiry.
4. Next.js's route-interception layer decodes/verifies the cookie for
   **route gating** only (redirect anonymous users away from gated
   routes) — a UX convenience, not the authorisation boundary. In this
   codebase that layer is `apps/web/src/proxy.ts`: Next.js 16 renamed the
   `middleware.ts` file convention to `proxy.ts` (same
   request-intercepting mechanism, new filename/export), so where earlier
   PRD drafts say "middleware", the implementation is `src/proxy.ts`.
5. The **service layer** re-verifies the session and performs
   **object-level authorisation** (owner match, same `agencyId`, or admin
   role) on every mutation, independent of what `src/proxy.ts` already
   allowed through.
6. `DELETE /api/v1/auth/session` clears the cookie for sign-out.

Roles are custom claims `{ role: 'user' | 'owner' | 'agent' | 'admin', agencyId?: string }`,
mirrored to/from `users.role` and `users.agency_id` in Postgres (PRD §9.2).
Role upgrades are server-driven; claims are force-refreshed immediately
after an upgrade rather than waiting for the client's natural token
refresh cycle.

## Consequences

**Positive**

- Meets PRD §7.4 verbatim: HTTP-only/Secure/SameSite=Lax cookie, Admin SDK
  verification, claims re-checked server-side.
- Two-tier trust (`src/proxy.ts` for UX gating, service layer for real
  authorisation) means a bug in `src/proxy.ts` that lets an unauthenticated
  request through a gated route cannot, by itself, produce an
  unauthorised mutation — the service layer is the actual security
  boundary, and it is unit-testable in isolation with fake sessions.
- A single exchange per sign-in avoids shipping Firebase ID-token refresh
  logic to every client route; the browser just carries a cookie like any
  other session.
- 14-day sliding expiry balances user convenience against the blast
  radius of a stolen cookie, consistent with a consumer marketplace (not
  a banking app) risk profile.

**Negative / accepted costs**

- Session state now has two sources of truth to keep in sync conceptually
  (Firebase custom claims and the Doorstep session cookie); a claims
  change requires either a forced token refresh or waiting out the
  cookie's validity window, which the "force refresh after upgrade" step
  exists specifically to close.
- Admin MFA (PRD §7.4) is enforced via Firebase's multi-factor flow before
  session exchange for `admin`-role sign-ins; this is an M5-era concern
  operationally but the session-exchange design accommodates it from M0
  without rework.
- Revocation (e.g. banning a user mid-session) requires either a short
  cookie TTL, an explicit revocation check against a deny-list, or
  accepting up to the sliding-window delay before a ban takes effect;
  M0 does not yet implement a fast-revocation path — tracked as a gap to
  close before the admin "suspend/ban" capability (ADM-3, PRD §6.6) ships
  in M5.

## Alternatives rejected

- **Send the Firebase ID token on every request (bearer token, no session
  cookie).** Simpler exchange step, but requires client-side silent
  refresh logic on every surface, puts a bearer token in every request
  (and risk of log exposure), and does not match the HTTP-only cookie
  requirement in PRD §7.4. Rejected.
- **NextAuth.js / Auth.js with a Firebase provider.** Would add a second
  auth abstraction on top of Firebase without removing the need to talk to
  the Firebase Admin SDK for claims, and the PRD already specifies the
  Admin-SDK-verified session-cookie flow directly. Rejected as
  unnecessary indirection for a single provider setup.
- **Firebase-hosted session management (client SDK persistence only, no
  server cookie).** Would leave every server route unable to
  authenticate a request without a client-side round trip, incompatible
  with RSC/ISR rendering and with a future Flutter client hitting
  `/api/v1` directly. Rejected — conflicts with PRD §8.3's rendering
  strategy for auth-gated dashboards.
