# Launch checklist (PRD §17)

Tracks PRD section 17 items for beta launch in Reading.  
**Done (code)** = shipped in this repo. **Ops** = manual / infrastructure.

| Item | Done (code) | Ops |
|------|-------------|-----|
| Domain + DNS + HTTPS | — | Vercel custom domain, DNS |
| Separate prod Firebase + Neon, restricted access | Dev/preview/prod projects in docs | Lock IAM, rotate keys |
| Backups verified by actual restore | — | Neon restore drill |
| Sentry alerts to email/phone | Sentry SDK wired | Alert rules |
| Uptime monitors (3 synthetic checks) | Health via search + home routes | Configure monitors |
| Legal pages live (privacy, cookies, terms, complaints) | `/privacy`, `/cookies`, `/terms`, `/complaints` | Legal review copy |
| ICO registration | — | Register with ICO |
| Cookie consent vs PECR | `cookie-consent-banner.tsx` | QA in prod |
| DSAR export/erase scripts tested | `pnpm dsar:export`, `pnpm dsar:erase` | Run once on staging |
| OWASP ASVS L1 checklist | [`security/OWASP-ASVS-L1.md`](security/OWASP-ASVS-L1.md) | Close Partial/Ops rows |
| Load test 10× search RPS | `pnpm bench:search` tooling | Run against staging |
| Lighthouse + axe budgets (home, search, detail) | e2e axe smoke (m2–m4) | Manual Lighthouse pass |
| Search Console + sitemap | `app/sitemap.ts`, `robots.ts` | Verify property, submit sitemap |
| Analytics events QA | `POST /api/v1/events`, admin metrics | Dashboard reconciliation |
| Seed content (2–3 agencies, 50+ listings) | `pnpm seed` | Partner agencies, real stock |
| Moderation rota (first weeks) | Admin queue UI | Team schedule |
| Search-down Saturday runbook | [`runbooks/INCIDENT-SEARCH-OUTAGE.md`](runbooks/INCIDENT-SEARCH-OUTAGE.md) | On-call assignment |
| Outbox drain cadence (1-min SLA) | Hobby: GH Actions 5m + daily Vercel safety-net; Pro: restore `* * * * *` | Set `APP_URL`/`CRON_SECRET` GH secrets; consider Vercel Pro |
| Detail location map (DET-3) | OSM embed on `/property/{slug}` | — |

## M4–M6 code delivered (this branch)

- **M4:** Enquiries (Turnstile, rate limits, Resend), favourites, saved searches (+ save button on results), account profile/delete, lister enquiry inbox.
- **M5:** Admin moderation, reports, users/agencies, audit log, analytics events, retention cron.
- **M6:** SEO (sitemap, JSON-LD, OG), legal/GDPR pack, cookie consent, DSAR runbook + scripts, OWASP L1 doc, incident runbook.

## Known gaps

- Gallery lightbox / floorplan tabs — deferred post-MVP polish.
- Geocode cache still in-process; Upstash Redis optional upgrade for multi-instance cache.
