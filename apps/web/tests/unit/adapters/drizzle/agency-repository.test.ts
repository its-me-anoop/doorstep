import postgres from 'postgres'
import { describe, expect, it } from 'vitest'

import {
  mapAgencyUniqueViolation,
  mapRowToAgency,
} from '@/adapters/drizzle/repositories/agency-repository'
import { AgencySlugConflictError } from '@/ports/agency-repository'

// mapRowToAgency is a pure function (row -> domain Agency), so it is
// unit-testable without a database connection. DrizzleAgencyRepository's
// query methods are exercised against a real Postgres instance in
// tests/integration/agency-repository.test.ts, gated on TEST_DATABASE_URL.
describe('mapRowToAgency', () => {
  it('maps an agencies row to the AgencyRepository port shape', () => {
    const row = {
      id: '0190f4b0-0000-7000-8000-000000000010',
      name: 'Thameside Property Partners',
      slug: 'thameside-property-partners',
      logoPath: 'agencies/thameside/logo.png',
      phone: '0118 950 1147',
      email: 'hello@thamesidepropertypartners.co.uk',
      website: 'https://www.thamesidepropertypartners.co.uk',
      address: '12 Kings Road, Reading, RG1 3AA',
      verified: true,
      createdBy: '0190f4b0-0000-7000-8000-000000000001',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T09:00:00Z'),
    }

    expect(mapRowToAgency(row)).toEqual(row)
  })

  it('maps a null logoPath through unchanged', () => {
    const row = {
      id: '0190f4b0-0000-7000-8000-000000000011',
      name: 'Caversham Kennet Estates',
      slug: 'caversham-kennet-estates',
      logoPath: null,
      phone: '0118 946 2830',
      email: 'enquiries@cavershamkennetestates.co.uk',
      website: 'https://www.cavershamkennetestates.co.uk',
      address: '5 Church Street, Caversham, RG4 8AU',
      verified: false,
      createdBy: '0190f4b0-0000-7000-8000-000000000002',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }

    expect(mapRowToAgency(row).logoPath).toBeNull()
  })
})

// mapAgencyUniqueViolation is the same kind of pure, DB-free translation as
// adapters/drizzle/repositories/user-repository.ts's mapUniqueViolation —
// the failure mode it exists for (two concurrent onboarding requests
// hitting agencies_slug_idx) is exercised end-to-end against a real
// Postgres instance in tests/integration/agency-repository.test.ts.
describe('mapAgencyUniqueViolation', () => {
  function uniqueViolation(constraintName: string): postgres.PostgresError {
    const error = new postgres.PostgresError(
      `duplicate key value violates unique constraint "${constraintName}"`,
    )
    error.code = '23505'
    error.constraint_name = constraintName
    return error
  }

  it('maps an agencies_slug_idx violation to an AgencySlugConflictError carrying the attempted slug', () => {
    const result = mapAgencyUniqueViolation(
      uniqueViolation('agencies_slug_idx'),
      'thameside-property-partners',
    )

    expect(result).toBeInstanceOf(AgencySlugConflictError)
    expect(result?.slug).toBe('thameside-property-partners')
  })

  // drizzle-orm (the postgres-js driver, 0.45.x) never throws the raw
  // postgres.PostgresError from a real db.insert() call — it wraps it in
  // its own DrizzleQueryError, with the original error on `.cause`. This
  // is what tests/integration/agency-repository.test.ts's real duplicate
  // insert actually throws, so the mapper must unwrap one level rather
  // than checking `instanceof postgres.PostgresError` on the top-level
  // error alone. Modelled here without importing drizzle-orm's error
  // class, since the unwrap only relies on the standard `cause` field.
  it('unwraps a query-error wrapper (e.g. drizzle-orm DrizzleQueryError) to find the underlying PostgresError', () => {
    const wrapped = new Error('Failed query: insert into "agencies" ...', {
      cause: uniqueViolation('agencies_slug_idx'),
    })

    const result = mapAgencyUniqueViolation(
      wrapped,
      'thameside-property-partners',
    )

    expect(result).toBeInstanceOf(AgencySlugConflictError)
    expect(result?.slug).toBe('thameside-property-partners')
  })

  it('returns null for a unique violation on an unrelated constraint', () => {
    const result = mapAgencyUniqueViolation(
      uniqueViolation('users_email_idx'),
      'thameside-property-partners',
    )

    expect(result).toBeNull()
  })

  it('returns null for a Postgres error that is not a unique violation (e.g. the created_by FK)', () => {
    const fkViolation = new postgres.PostgresError(
      'insert or update on table "agencies" violates foreign key constraint "agencies_created_by_users_id_fk"',
    )
    fkViolation.code = '23503'

    expect(
      mapAgencyUniqueViolation(fkViolation, 'thameside-property-partners'),
    ).toBeNull()
  })

  it('returns null for a non-Postgres error', () => {
    expect(
      mapAgencyUniqueViolation(
        new Error('connection reset'),
        'thameside-property-partners',
      ),
    ).toBeNull()
  })
})
