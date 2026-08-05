/**
 * DrizzleAgencyRepository — the AgencyRepository port (ports/) implemented
 * against `agencies` (PRD §9.2), following DrizzleUserRepository's shape
 * (repositories/user-repository.ts) exactly: constructor-injected `Db`
 * (DIP, unit-testable with an in-memory fake later), pure row/error
 * mappers exported and unit-tested directly, the class itself exercised
 * against a real Postgres instance in tests/integration/.
 */

import { eq } from 'drizzle-orm'
import postgres from 'postgres'

import {
  AgencySlugConflictError,
  type Agency,
  type AgencyRepository,
} from '@/ports/agency-repository'

import type { Db } from '../client'
import { agencies } from '../schema'

type AgencyRow = typeof agencies.$inferSelect

const POSTGRES_UNIQUE_VIOLATION = '23505'

/**
 * Translates a Postgres unique-violation error raised on `agencies` into
 * the AgencyRepository port's typed AgencySlugConflictError, so services/
 * never has to know about a Postgres error code (DIP). `slug` is the value
 * the caller attempted to insert — the error object itself carries no
 * column value, only the constraint name. Returns null for anything else
 * (including a unique violation on some other constraint, and the
 * `created_by` foreign-key violation, which has a different error code),
 * so `create()` can rethrow the original error unchanged.
 */
export function mapAgencyUniqueViolation(
  error: unknown,
  slug: string,
): AgencySlugConflictError | null {
  const postgresError = extractPostgresError(error)
  if (
    !postgresError ||
    postgresError.code !== POSTGRES_UNIQUE_VIOLATION ||
    postgresError.constraint_name !== 'agencies_slug_idx'
  ) {
    return null
  }
  return new AgencySlugConflictError(slug)
}

/**
 * drizzle-orm's postgres-js driver (0.45.x) never lets a real
 * db.insert()/db.update() failure surface as a bare postgres.PostgresError
 * — it wraps every query failure in its own DrizzleQueryError, with the
 * original driver error attached via the standard `cause` field. Unwraps
 * one level so callers can pattern-match on the real driver error
 * regardless of whether it arrived bare (as constructed directly in this
 * file's unit tests) or wrapped (as a live query throws it — see
 * tests/integration/agency-repository.test.ts). Duck-types on `cause`
 * rather than importing drizzle-orm's error class, so this keeps working
 * across drizzle-orm versions that wrap differently as long as they keep
 * using the standard Error `cause` chain.
 */
function extractPostgresError(error: unknown): postgres.PostgresError | null {
  if (error instanceof postgres.PostgresError) return error
  if (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    (error as { cause?: unknown }).cause instanceof postgres.PostgresError
  ) {
    return (error as { cause: postgres.PostgresError }).cause
  }
  return null
}

/** Maps an `agencies` table row to the AgencyRepository port's `Agency`
 * shape. Pure and DB-free, so it is unit-tested directly. */
export function mapRowToAgency(row: AgencyRow): Agency {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoPath: row.logoPath,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    verified: row.verified,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleAgencyRepository implements AgencyRepository {
  constructor(private readonly db: Db) {}

  async findBySlug(slug: string): Promise<Agency | null> {
    const [row] = await this.db
      .select()
      .from(agencies)
      .where(eq(agencies.slug, slug))
      .limit(1)
    return row ? mapRowToAgency(row) : null
  }

  async findById(id: string): Promise<Agency | null> {
    const [row] = await this.db
      .select()
      .from(agencies)
      .where(eq(agencies.id, id))
      .limit(1)
    return row ? mapRowToAgency(row) : null
  }

  async create(
    agency: Omit<Agency, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Agency> {
    try {
      const [row] = await this.db
        .insert(agencies)
        .values({
          name: agency.name,
          slug: agency.slug,
          logoPath: agency.logoPath,
          phone: agency.phone,
          email: agency.email,
          website: agency.website,
          address: agency.address,
          verified: agency.verified,
          createdBy: agency.createdBy,
        })
        .returning()
      if (!row) {
        throw new Error(
          'DrizzleAgencyRepository.create: insert returned no row',
        )
      }
      return mapRowToAgency(row)
    } catch (error) {
      throw mapAgencyUniqueViolation(error, agency.slug) ?? error
    }
  }
}
