/**
 * DSAR export — GDPR subject access (PRD §7.5).
 *
 * Dumps a user's profile, owned listings, enquiries they sent, saved
 * properties, saved searches, and audit-log rows where they were the actor
 * to stdout as JSON.
 *
 * Usage (from apps/web):
 *   USER_ID=<uuid> pnpm dsar:export
 *   EMAIL=user@example.co.uk pnpm dsar:export
 *
 * Requires DATABASE_URL. Production ops only — handle output as personal data.
 */

import { eq } from 'drizzle-orm'

import { getDb, schema } from '@/adapters/drizzle'

const {
  users,
  properties,
  enquiries,
  savedProperties,
  savedSearches,
  auditLog,
} = schema

function assertDatabaseUrlSet(): void {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
}

async function resolveUserId(): Promise<string> {
  const userId = process.env.USER_ID?.trim()
  const email = process.env.EMAIL?.trim()

  if (!userId && !email) {
    console.error('Set USER_ID or EMAIL.')
    process.exit(1)
  }
  if (userId && email) {
    console.error('Set only one of USER_ID or EMAIL.')
    process.exit(1)
  }

  const db = getDb()

  if (userId) return userId

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email!))
    .limit(1)

  if (!row) {
    console.error(`No user found for EMAIL=${email}`)
    process.exit(1)
  }

  return row.id
}

async function main(): Promise<void> {
  assertDatabaseUrlSet()
  const userId = await resolveUserId()
  const db = getDb()

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!profile) {
    console.error(`No user found for USER_ID=${userId}`)
    process.exit(1)
  }

  const listings = await db
    .select()
    .from(properties)
    .where(eq(properties.listerId, userId))

  const sentEnquiries = await db
    .select()
    .from(enquiries)
    .where(eq(enquiries.senderId, userId))

  const favourites = await db
    .select()
    .from(savedProperties)
    .where(eq(savedProperties.userId, userId))

  const searches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))

  const auditRows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.actorId, userId))

  const payload = {
    exportedAt: new Date().toISOString(),
    userId,
    profile,
    listings,
    enquiriesAsSender: sentEnquiries,
    savedProperties: favourites,
    savedSearches: searches,
    auditLogAsActor: auditRows,
  }

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

main().catch((error: unknown) => {
  console.error('dsar-export failed:', error)
  process.exit(1)
})
