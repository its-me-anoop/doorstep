# Incident runbook: search outage (Saturday playbook)

**When to use:** Public search returns `search_unavailable` (503), empty results with healthy Postgres, or elevated Meilisearch errors.  
**Goal:** Restore search within **60 minutes** for beta SLA; communicate if longer.

## 1. Confirm the symptom

1. Hit `GET /api/v1/search?channel=sale` (or open `/for-sale`) — expect `503` with `{ error: { code: 'search_unavailable' } }` when Meilisearch is down.
2. Check **Sentry** and Vercel function logs for `search-listings` / Meilisearch client errors.
3. Verify **Postgres** is healthy (Neon dashboard) — listings source of truth must be up even if search is not.

## 2. Meilisearch health

1. Open **Meilisearch Cloud** dashboard (EU project).
2. Check cluster status, task queue backlog, and recent deploys.
3. If the index is corrupt or empty but Postgres is fine, proceed to reindex (step 4).

## 3. Outbox drain

Search visibility depends on the outbox consumer (PRD §6.5 LST-5):

1. Confirm the outbox drain is firing — on Vercel Hobby via
   `.github/workflows/outbox-drain.yml` (every 5 minutes when `APP_URL` /
   `CRON_SECRET` secrets are set) or, on Vercel Pro, via
   `GET /api/cron/outbox-drain` on a `* * * * *` schedule in
   `apps/web/vercel.json`. Hobby `vercel.json` keeps a daily safety-net
   drain only (sub-daily Vercel Cron Jobs require Pro).
2. Manually trigger with `CRON_SECRET`:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://<app>/api/cron/outbox-drain"
   ```
3. Inspect `outbox` table for stuck rows (claimed_at older than lease, or growing `pending` count).

## 4. Full reindex

If Meilisearch is up but documents are missing or stale:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<app>/api/cron/reindex"
```

Or from a trusted machine with env vars: `pnpm reindex:local` (see `scripts/reindex-local.ts`).

Compare Postgres indexable listing count vs Meilisearch document count in logs.

## 5. Feature flags & degradation

- **`NEXT_PUBLIC_FEATURE_MAP`:** Kill switch for map UI only; does not fix search API.
- **OutagePanel** is intentional degradation (PRD §7.6) — do not hide it until search recovers.
- If Meilisearch vendor incident: post status to stakeholders; area pages and detail still serve from Postgres.

## 6. Escalation

| Role | Action |
|------|--------|
| On-call engineer | Steps 1–4, ticket updates every 30 min |
| Product | User comms if >1 h |
| Meilisearch support | Open ticket if platform-side |

## 7. Post-incident

- Root cause in ticket (outbox stall, Meilisearch outage, bad deploy, rate limit).
- Add missing monitor if detection was slow (synthetic check on `/api/v1/search`).
- Schedule restore drill if Postgres was involved.

## Related

- Architecture: search sync §13–§15 in [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- Launch checklist: [`../LAUNCH-CHECKLIST.md`](../LAUNCH-CHECKLIST.md)
