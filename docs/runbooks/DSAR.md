# DSAR runbook (GDPR subject access & erasure)

**Owner:** Engineering + DPO (Flutterly Ltd)  
**SLA:** Respond to valid requests within **30 calendar days** (UK GDPR Art. 12).  
**Last updated:** August 2026

## Who can request

- A signed-in user may export or delete their own account via the product (`/account`, Delete account).
- Anyone may email **privacy@doorstep.co.uk** (or the address published on `/privacy`) to exercise access, erasure, rectification, or restriction. Ops verifies identity before running scripts (match email to `users.email`, or use a signed-in session).

## Export (subject access)

From `apps/web` with production `DATABASE_URL` (read-only credential preferred):

```bash
# By internal user id
USER_ID=<uuid> pnpm dsar:export > dsar-export-<id>.json

# By account email
EMAIL=user@example.co.uk pnpm dsar:export > dsar-export-<email>.json
```

The JSON includes: profile, owned listings, enquiries sent, saved properties, saved searches, and audit-log rows where the user was the actor.

**Handling:** Store exports encrypted, share via secure channel only, delete working copies within 30 days of delivery unless a dispute requires retention.

## Erasure (right to be forgotten)

Prefer the in-app **Delete account** flow when the user can sign in (`DELETE /api/v1/me`).

For ops-assisted erasure:

```bash
USER_ID=<uuid> pnpm dsar:erase
# Or non-interactive after ticket approval:
DSAR_ERASE_CONFIRM=<uuid> USER_ID=<uuid> pnpm dsar:erase
```

This mirrors `DeleteAccount`: anonymises enquiries, clears favourites and saved searches, hides live listings (deletes drafts), removes the Firebase Auth user when Admin SDK is configured, then deletes the `users` row.

**Before running:** Confirm ticket, identity, and that no legal hold applies. Log the ticket id in your ops notes.

## Related

- Enquiry retention cron: `GET /api/cron/retention` (anonymises stale enquiries per PRD §7.5).
- Privacy policy: `/privacy`
- OWASP / security checklist: [`../security/OWASP-ASVS-L1.md`](../security/OWASP-ASVS-L1.md)
