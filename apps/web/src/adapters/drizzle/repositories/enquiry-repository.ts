/**
 * DrizzleEnquiryRepository — the EnquiryReader/EnquiryWriter ports
 * (ports/enquiry-repository.ts) implemented against `enquiries`, in the
 * same shape as this directory's other repositories.
 */

import { and, count, desc, eq, lt, or, type SQL } from 'drizzle-orm'

import type { EnquiryStatus } from '@/domain/enums'
import {
  EnquiryNotFoundError,
  type Enquiry,
  type EnquiryCursorPage,
  type EnquiryReader,
  type EnquiryWriter,
  type ListEnquiriesOptions,
  type NewEnquiry,
} from '@/ports/enquiry-repository'

import type { Db } from '../client'
import { enquiries, properties } from '../schema'

type EnquiryRow = typeof enquiries.$inferSelect

const DEFAULT_PAGE_LIMIT = 20

const ANONYMISED_NAME = '[deleted user]'
const ANONYMISED_EMAIL = 'deleted@anonymised.invalid'
const ANONYMISED_MESSAGE = '[message removed]'

/** Maps an `enquiries` table row to the EnquiryRepository port's `Enquiry`
 * shape. Pure and DB-free, so it is unit-tested directly. */
export function mapRowToEnquiry(row: EnquiryRow): Enquiry {
  return {
    id: row.id,
    propertyId: row.propertyId,
    senderId: row.senderId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    viewingRequested: row.viewingRequested,
    status: row.status,
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleEnquiryRepository implements EnquiryReader, EnquiryWriter {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Enquiry | null> {
    const [row] = await this.db
      .select()
      .from(enquiries)
      .where(eq(enquiries.id, id))
      .limit(1)
    return row ? mapRowToEnquiry(row) : null
  }

  async listByProperty(
    propertyId: string,
    options?: ListEnquiriesOptions,
  ): Promise<EnquiryCursorPage<Enquiry>> {
    return this.paginate(eq(enquiries.propertyId, propertyId), options)
  }

  async listForLister(
    listerId: string,
    agencyId: string | null,
    options?: ListEnquiriesOptions,
  ): Promise<EnquiryCursorPage<Enquiry>> {
    const propertyPredicate = agencyId
      ? eq(properties.agencyId, agencyId)
      : eq(properties.listerId, listerId)

    return this.paginateWithPropertyJoin(propertyPredicate, options)
  }

  async countByProperty(
    propertyId: string,
    status?: EnquiryStatus,
  ): Promise<number> {
    const clauses: SQL[] = [eq(enquiries.propertyId, propertyId)]
    if (status !== undefined) {
      clauses.push(eq(enquiries.status, status))
    }
    const [row] = await this.db
      .select({ value: count() })
      .from(enquiries)
      .where(and(...clauses))
    return row?.value ?? 0
  }

  async countNewForLister(
    listerId: string,
    agencyId: string | null,
  ): Promise<number> {
    const propertyPredicate = agencyId
      ? eq(properties.agencyId, agencyId)
      : eq(properties.listerId, listerId)

    const [row] = await this.db
      .select({ value: count() })
      .from(enquiries)
      .innerJoin(properties, eq(enquiries.propertyId, properties.id))
      .where(and(propertyPredicate, eq(enquiries.status, 'new')))
    return row?.value ?? 0
  }

  async create(enquiry: NewEnquiry): Promise<Enquiry> {
    const [row] = await this.db
      .insert(enquiries)
      .values({
        propertyId: enquiry.propertyId,
        senderId: enquiry.senderId,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        message: enquiry.message,
        viewingRequested: enquiry.viewingRequested,
      })
      .returning()
    if (!row) {
      throw new Error('DrizzleEnquiryRepository.create: insert returned no row')
    }
    return mapRowToEnquiry(row)
  }

  async updateStatus(id: string, status: EnquiryStatus): Promise<Enquiry> {
    const [row] = await this.db
      .update(enquiries)
      .set({ status })
      .where(eq(enquiries.id, id))
      .returning()
    if (!row) throw new EnquiryNotFoundError(id)
    return mapRowToEnquiry(row)
  }

  async markDelivered(id: string, deliveredAt: Date): Promise<Enquiry> {
    const [row] = await this.db
      .update(enquiries)
      .set({ deliveredAt })
      .where(eq(enquiries.id, id))
      .returning()
    if (!row) throw new EnquiryNotFoundError(id)
    return mapRowToEnquiry(row)
  }

  async anonymiseOlderThan(cutoff: Date): Promise<number> {
    const rows = await this.db
      .update(enquiries)
      .set({
        name: ANONYMISED_NAME,
        email: ANONYMISED_EMAIL,
        phone: null,
        message: ANONYMISED_MESSAGE,
      })
      .where(lt(enquiries.createdAt, cutoff))
      .returning({ id: enquiries.id })
    return rows.length
  }

  async anonymiseForUser(userId: string, email: string): Promise<number> {
    const rows = await this.db
      .update(enquiries)
      .set({
        name: ANONYMISED_NAME,
        email: ANONYMISED_EMAIL,
        phone: null,
        message: ANONYMISED_MESSAGE,
        senderId: null,
      })
      .where(or(eq(enquiries.senderId, userId), eq(enquiries.email, email)))
      .returning({ id: enquiries.id })
    return rows.length
  }

  private async paginate(
    predicate: SQL,
    { cursor, limit = DEFAULT_PAGE_LIMIT, status }: ListEnquiriesOptions = {},
  ): Promise<EnquiryCursorPage<Enquiry>> {
    const clauses: SQL[] = [predicate]
    if (status !== undefined) {
      clauses.push(eq(enquiries.status, status))
    }
    if (cursor) {
      clauses.push(lt(enquiries.id, cursor))
    }

    const rows = await this.db
      .select()
      .from(enquiries)
      .where(and(...clauses))
      .orderBy(desc(enquiries.id))
      .limit(limit + 1)

    const page = rows.slice(0, limit)
    const nextCursor = rows.length > limit ? (page.at(-1)?.id ?? null) : null

    return { data: page.map(mapRowToEnquiry), nextCursor }
  }

  private async paginateWithPropertyJoin(
    propertyPredicate: SQL,
    { cursor, limit = DEFAULT_PAGE_LIMIT, status }: ListEnquiriesOptions = {},
  ): Promise<EnquiryCursorPage<Enquiry>> {
    const clauses: SQL[] = [propertyPredicate]
    if (status !== undefined) {
      clauses.push(eq(enquiries.status, status))
    }
    if (cursor) {
      clauses.push(lt(enquiries.id, cursor))
    }

    const rows = await this.db
      .select({ enquiry: enquiries })
      .from(enquiries)
      .innerJoin(properties, eq(enquiries.propertyId, properties.id))
      .where(and(...clauses))
      .orderBy(desc(enquiries.id))
      .limit(limit + 1)

    const page = rows.slice(0, limit)
    const nextCursor =
      rows.length > limit ? (page.at(-1)?.enquiry.id ?? null) : null

    return {
      data: page.map((row) => mapRowToEnquiry(row.enquiry)),
      nextCursor,
    }
  }
}
