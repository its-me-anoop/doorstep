# OWASP ASVS Level 1 — Doorstep self-assessment

Mapped to [OWASP ASVS 4.0](https://github.com/OWASP/ASVS) Level 1 controls.  
**Status:** Done (in code) · Partial (needs ops/config) · Ops (manual process)

| ID | Control | Doorstep implementation | Status |
|----|---------|-------------------------|--------|
| V1.1 | Secure SDLC | CI: typecheck, lint, unit, integration, build, e2e; PR review | Done |
| V2.1 | Password / auth policy | Firebase Auth (email, Google, Apple); no local passwords stored | Done |
| V2.2 | Session management | HttpOnly session cookies via Firebase Admin `createSessionCookie`; `SESSION_COOKIE_NAME` | Done |
| V2.3 | Session termination | Sign-out clears cookie; `terminateSession` | Done |
| V2.4 | Cookie attributes | Secure, SameSite=Lax on session cookie (production) | Partial — verify Vercel prod cookie flags |
| V3.1 | Input validation | Zod on API bodies and query params (`lib/validation/*`) | Done |
| V3.2 | Output encoding | React default escaping; no `dangerouslySetInnerHTML` except JSON-LD | Done |
| V4.1 | Access control | DB-backed roles in layouts/services; session claims UX-only (`decide-gate.ts`) | Done |
| V4.2 | Admin separation | `(admin)` route group; admin services; audit log on decisions | Done |
| V4.3 | Admin MFA | Firebase MFA for admin accounts | Ops — enforce in Firebase console for `admin` role UIDs |
| V5.1 | Injection | Drizzle parameterised queries; no raw SQL from user input | Done |
| V5.2 | Deserialization | JSON parsed then Zod-validated; no `eval` | Done |
| V7.1 | Log sensitive data | PII not logged in enquiry bodies; server errors generic to clients | Partial — audit log review in ops |
| V8.1 | Data protection | GDPR pages, cookie banner, retention cron, DSAR scripts | Done (code); Ops — ICO registration |
| V8.2 | Retention | `GET /api/cron/retention` anonymises old enquiries | Done |
| V9.1 | HTTPS | Vercel TLS; HSTS via platform | Ops — confirm custom domain |
| V10.1 | Malicious uploads | Images: signed upload, type/size limits, sharp re-encode, EXIF strip | Done |
| V11.1 | Business logic | Listing state machine; admin-only publish; rate limits on enquiries | Done |
| V12.1 | Files / SSRF | Server fetches limited to configured providers (Mapbox, postcodes.io, Turnstile) | Done |
| V13.1 | API security | `/api/v1/*` JSON errors; cron routes gated by `CRON_SECRET` | Done |
| V13.2 | Rate limiting | Upstash Redis + in-memory fallback on enquiry submit | Done (code); Ops — Upstash in prod |
| V14.1 | Build / deploy | Secrets in Vercel env; no keys in repo | Ops |
| V14.2 | Dependency hygiene | `pnpm audit` in CI; lockfile committed | Partial |
| V15.1 | Security headers | `vercel.json` / Next headers where configured | Partial — review CSP for maps/OSM embed |
| Bot abuse | CAPTCHA | Cloudflare Turnstile on enquiry form when `TURNSTILE_SECRET_KEY` set | Done (code); Ops — keys in prod |

## Gaps to close before launch

1. **Admin MFA** — enable and document for all `admin` Firebase users.
2. **Production Redis** — `UPSTASH_REDIS_REST_URL` / `TOKEN` for distributed rate limits.
3. **ICO registration** — legal ops (see LAUNCH-CHECKLIST).
4. **Restore drill** — Neon backup restore tested (ops).

Review quarterly or after major releases.
