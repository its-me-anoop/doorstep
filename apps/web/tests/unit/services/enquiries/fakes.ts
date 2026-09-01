/**
 * In-memory fakes for services/enquiries/* unit tests.
 */

import type { EnquiryStatus } from '@/domain/enums'
import type { EnquiryEntity } from '@/domain/enquiry'
import {
  EnquiryNotFoundError,
  type Enquiry,
  type EnquiryCursorPage,
  type EnquiryReader,
  type EnquiryWriter,
  type ListEnquiriesOptions,
  type NewEnquiry,
} from '@/ports/enquiry-repository'

const DEFAULT_LIMIT = 20

export class FakeEnquiryRepository implements EnquiryReader, EnquiryWriter {
  private readonly byId = new Map<string, Enquiry>()
  private nextId = 1

  readonly anonymisedOlderThan: Date[] = []
  readonly anonymisedForUser: Array<{ userId: string; email: string }> = []

  async findById(id: string): Promise<Enquiry | null> {
    return this.byId.get(id) ?? null
  }

  async listByProperty(
    propertyId: string,
    options: ListEnquiriesOptions = {},
  ): Promise<EnquiryCursorPage<Enquiry>> {
    return this.paginate(
      (enquiry) => enquiry.propertyId === propertyId,
      options,
    )
  }

  async listForLister(
    listerId: string,
    _agencyId: string | null,
    options: ListEnquiriesOptions = {},
  ): Promise<EnquiryCursorPage<Enquiry>> {
    void listerId
    return this.paginate(() => true, options)
  }

  async countByProperty(): Promise<number> {
    return this.byId.size
  }

  async countNewForLister(): Promise<number> {
    return [...this.byId.values()].filter((enquiry) => enquiry.status === 'new')
      .length
  }

  async create(enquiry: NewEnquiry): Promise<Enquiry> {
    const now = new Date()
    const created: Enquiry = {
      id: `enquiry-${this.nextId++}`,
      ...enquiry,
      status: 'new',
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(created.id, created)
    return created
  }

  async updateStatus(id: string, status: EnquiryStatus): Promise<Enquiry> {
    const existing = this.getOrThrow(id)
    const updated: Enquiry = {
      ...existing,
      status,
      updatedAt: new Date(),
    }
    this.byId.set(id, updated)
    return updated
  }

  async markDelivered(id: string, deliveredAt: Date): Promise<Enquiry> {
    const existing = this.getOrThrow(id)
    const updated: Enquiry = {
      ...existing,
      deliveredAt,
      updatedAt: deliveredAt,
    }
    this.byId.set(id, updated)
    return updated
  }

  async anonymiseOlderThan(cutoff: Date): Promise<number> {
    this.anonymisedOlderThan.push(cutoff)
    return 0
  }

  async anonymiseForUser(userId: string, email: string): Promise<number> {
    this.anonymisedForUser.push({ userId, email })
    let count = 0
    for (const [id, enquiry] of this.byId) {
      if (enquiry.senderId === userId || enquiry.email === email) {
        this.byId.set(id, {
          ...enquiry,
          name: '[deleted]',
          email: '[deleted]',
          phone: null,
          message: '[deleted]',
        })
        count++
      }
    }
    return count
  }

  seed(enquiry: EnquiryEntity): void {
    this.byId.set(enquiry.id, enquiry)
  }

  private getOrThrow(id: string): Enquiry {
    const existing = this.byId.get(id)
    if (!existing) throw new EnquiryNotFoundError(id)
    return existing
  }

  private paginate(
    predicate: (enquiry: Enquiry) => boolean,
    { cursor, limit = DEFAULT_LIMIT }: ListEnquiriesOptions,
  ): EnquiryCursorPage<Enquiry> {
    const matches = [...this.byId.values()]
      .filter(predicate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const startIndex = cursor
      ? matches.findIndex((enquiry) => enquiry.id === cursor) + 1
      : 0
    const page = matches.slice(startIndex, startIndex + limit)
    const nextCursor =
      startIndex + limit < matches.length ? (page.at(-1)?.id ?? null) : null

    return { data: page, nextCursor }
  }
}

export class FakeMailer {
  readonly sent: Array<{
    to: string
    subject: string
    template: string
    data: Record<string, unknown>
  }> = []

  async send(message: {
    to: string
    subject: string
    template: string
    data: Record<string, unknown>
  }): Promise<{ id: string }> {
    this.sent.push(message)
    return { id: `mail-${this.sent.length}` }
  }
}

export class FakeRateLimiter {
  private readonly counts = new Map<string, number>()
  limit = 5

  async consume(
    key: string,
    limit: number,
    _windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    void _windowSeconds
    const count = (this.counts.get(key) ?? 0) + 1
    this.counts.set(key, count)
    const allowed = count <= (this.limit ?? limit)
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetAt: new Date(Date.now() + 60 * 60 * 1000),
    }
  }
}

export class FakeCaptchaVerifier {
  valid = true

  async verify(): Promise<boolean> {
    return this.valid
  }
}
