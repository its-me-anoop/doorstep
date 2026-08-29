/**
 * DSAR erasure — GDPR right to erasure (PRD §7.5, §6.3 ACC-3).
 *
 * Irreversibly deletes a user account using the same steps as the in-app
 * DeleteAccount service: anonymise enquiries, clear favourites and saved
 * searches, hide or delete owned listings, remove the Firebase Auth user
 * (when Firebase Admin is configured), then delete the app profile row.
 *
 * Usage (from apps/web):
 *   USER_ID=<uuid> pnpm dsar:erase
 *
 * Requires DATABASE_URL. Firebase credentials are required in production so
 * the Auth user is removed; without them the script still erases app data
 * but logs a warning if Firebase delete fails.
 *
 * PRODUCTION OPS: confirm identity and legal basis before running. Prefer
 * the in-app Delete account flow when the user can sign in. This script is
 * for ops-assisted erasure (e.g. email request with no active session).
 */

import { eq } from 'drizzle-orm'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { getDb, schema, mapRowToUser } from '@/adapters/drizzle'
import { createServices } from '@/lib/composition'

const { users } = schema

function assertDatabaseUrlSet(): void {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
}

function resolveUserId(): string {
  const userId = process.env.USER_ID?.trim()
  if (!userId) {
    console.error('Set USER_ID.')
    process.exit(1)
  }
  return userId
}

async function confirm(userId: string, email: string): Promise<void> {
  if (process.env.DSAR_ERASE_CONFIRM === userId) return

  const rl = readline.createInterface({ input, output })
  try {
    const answer = await rl.question(
      `Type ERASE to permanently delete user ${email} (${userId}): `,
    )
    if (answer.trim() !== 'ERASE') {
      console.error('Aborted.')
      process.exit(1)
    }
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  assertDatabaseUrlSet()
  const userId = resolveUserId()
  const db = getDb()

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) {
    console.error(`No user found for USER_ID=${userId}`)
    process.exit(1)
  }

  const user = mapRowToUser(row)
  await confirm(userId, user.email)

  const { account } = createServices()
  await account.deleteAccount.execute(user)

  console.error(`Erased user ${user.email} (${userId}).`)
}

main().catch((error: unknown) => {
  console.error('dsar-erase failed:', error)
  process.exit(1)
})
