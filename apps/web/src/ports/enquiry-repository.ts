/**
 * EnquiryRepository — the `enquiries` table (PRD §9.2, domain/enquiry.ts).
 * Split per ISP: EnquiryReader for inbox/admin, EnquiryWriter for submit
 * and status updates. Anonymisation (GDPR retention, PRD §7.5) is a
 * writer concern so the retention cron never reaches for raw SQL.
 */

import type { EnquiryEntity } from '@/domain/enquiry'
import type { EnquiryStatus } from '@/domain/enums'

export type Enquiry = EnquiryEntity

export interface EnquiryCursorPage<T> {
  data: T[]
  nextCursor: string | null
}

export interface ListEnquiriesOptions {
  cursor?: string | null
  limit?: number
  status?: EnquiryStatus
}

export interface NewEnquiry {
  propertyId: string
  senderId: string | null
  name: string
  email: string
  phone: string | null
  message: string
  viewingRequested: boolean
}

export interface EnquiryReader {
  findById(id: string): Promise<Enquiry | null>
  /** Newest first, for a single listing's inbox (ENQ-4). */
  listByProperty(
    propertyId: string,
    options?: ListEnquiriesOptions,
  ): Promise<EnquiryCursorPage<Enquiry>>
  /** Newest first across every listing the actor manages (owner: own
   * listings; agent: agency listings). */
  listForLister(
    listerId: string,
    agencyId: string | null,
    options?: ListEnquiriesOptions,
  ): Promise<EnquiryCursorPage<Enquiry>>
  countByProperty(propertyId: string, status?: EnquiryStatus): Promise<number>
  countNewForLister(
    listerId: string,
    agencyId: string | null,
  ): Promise<number>
}

export interface EnquiryWriter {
  create(enquiry: NewEnquiry): Promise<Enquiry>
  updateStatus(id: string, status: EnquiryStatus): Promise<Enquiry>
  markDelivered(id: string, deliveredAt: Date): Promise<Enquiry>
  /**
   * GDPR retention (PRD §7.5): replace name/email/phone/message with
   * anonymised placeholders for rows older than the cutoff. Returns the
   * number of rows touched.
   */
  anonymiseOlderThan(cutoff: Date): Promise<number>
  /** GDPR account deletion: anonymise every enquiry authored by this
   * user (or matching their email when sender_id is null for guests who
   * later signed up — caller passes both). */
  anonymiseForUser(userId: string, email: string): Promise<number>
}

export class EnquiryNotFoundError extends Error {
  readonly enquiryId: string

  constructor(enquiryId: string) {
    super(`Enquiry not found: ${enquiryId}`)
    this.name = 'EnquiryNotFoundError'
    this.enquiryId = enquiryId
  }
}
