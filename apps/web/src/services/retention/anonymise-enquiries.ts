/**
 * AnonymiseEnquiries — GDPR retention cron (PRD §7.5): anonymise rows
 * older than 24 months via EnquiryWriter.anonymiseOlderThan.
 */

import type { Clock } from '@/ports/clock'
import type { EnquiryWriter } from '@/ports/enquiry-repository'

const RETENTION_MONTHS = 24

export class AnonymiseEnquiries {
  constructor(
    private readonly enquiryWriter: EnquiryWriter,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<number> {
    const cutoff = this.clock.now()
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS)
    return this.enquiryWriter.anonymiseOlderThan(cutoff)
  }
}
