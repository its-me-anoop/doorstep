/**
 * SubmitEnquiry — POST /api/v1/enquiries (PRD §6.4 ENQ-1/2/3). Guests
 * pass Turnstile + rate limits; signed-in users skip CAPTCHA. Honeypot
 * trips throw HoneypotTriggeredError for the route to map to a silent
 * 200. Only `published`/`under_offer` listings accept enquiries.
 */

import type { PropertyStatus } from '@/domain/enums'
import { submitEnquirySchema } from '@/lib/validation/enquiry'
import type { AgencyRepository } from '@/ports/agency-repository'
import type { CaptchaVerifier } from '@/ports/captcha-verifier'
import type { Clock } from '@/ports/clock'
import type { Enquiry, EnquiryWriter } from '@/ports/enquiry-repository'
import type { ListingReader } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { Mailer } from '@/ports/mailer'
import type { RateLimiter } from '@/ports/rate-limiter'
import type { User } from '@/ports/user-repository'
import type { UserRepository } from '@/ports/user-repository'

import {
  CaptchaFailedError,
  EnquiryValidationError,
  HoneypotTriggeredError,
  ListingNotEnquirableError,
  RateLimitedError,
} from './errors'

const ENQUIRABLE_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'published',
  'under_offer',
])

const RATE_LIMIT = 5
const RATE_WINDOW_SECONDS = 60 * 60

export interface SubmitEnquiryRequest {
  propertyId: string
  name: string
  email: string
  phone?: string | null
  message: string
  viewingRequested?: boolean
  /** Honeypot field — must be empty. */
  website?: string
  captchaToken?: string | null
  remoteIp?: string | null
}

export interface SubmitEnquiryDeps {
  listingBaseUrl?: string
}

export class SubmitEnquiry {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly userRepository: UserRepository,
    private readonly agencyRepository: AgencyRepository,
    private readonly enquiryWriter: EnquiryWriter,
    private readonly mailer: Mailer,
    private readonly rateLimiter: RateLimiter,
    private readonly captchaVerifier: CaptchaVerifier,
    private readonly clock: Clock,
    private readonly deps: SubmitEnquiryDeps = {},
  ) {}

  async execute(
    actor: User | null,
    input: SubmitEnquiryRequest,
  ): Promise<Enquiry> {
    if (input.website && input.website.trim() !== '') {
      throw new HoneypotTriggeredError()
    }

    const parsed = submitEnquirySchema.safeParse({
      ...input,
      website: input.website ?? '',
      viewingRequested: input.viewingRequested ?? false,
    })
    if (!parsed.success) {
      throw new EnquiryValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      )
    }

    const data = parsed.data
    const email = data.email.toLowerCase()
    const ip = input.remoteIp ?? 'unknown'

    await this.assertRateLimit(
      `enquiry:ip:${ip}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    )
    await this.assertRateLimit(
      `enquiry:email:${email}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS,
    )

    if (!actor) {
      const token = input.captchaToken?.trim()
      if (!token) throw new CaptchaFailedError()
      const valid = await this.captchaVerifier.verify(token, input.remoteIp)
      if (!valid) throw new CaptchaFailedError()
    }

    const listing = await this.listingReader.findById(data.propertyId)
    if (!listing) throw new ListingNotFoundError(data.propertyId)
    if (!ENQUIRABLE_STATUSES.has(listing.status)) {
      throw new ListingNotEnquirableError(data.propertyId)
    }

    const enquiry = await this.enquiryWriter.create({
      propertyId: data.propertyId,
      senderId: actor?.id ?? null,
      name: data.name,
      email,
      phone: data.phone ?? null,
      message: data.message,
      viewingRequested: data.viewingRequested,
    })

    const lister = await this.userRepository.findById(listing.listerId)
    if (!lister) {
      throw new Error(
        `Lister ${listing.listerId} not found for enquiry delivery`,
      )
    }

    const agency = listing.agencyId
      ? await this.agencyRepository.findById(listing.agencyId)
      : null

    const listingUrl = this.listingUrl(listing.slug)

    await this.mailer.send({
      to: lister.email,
      subject: `New enquiry on ${listing.title}`,
      template: 'enquiry-to-lister',
      data: {
        listingTitle: listing.title,
        listingUrl,
        enquirerName: data.name,
        enquirerEmail: email,
        enquirerPhone: data.phone ?? '',
        message: data.message,
        viewingRequested: data.viewingRequested,
        replyTo: email,
        agencyPhone: agency?.phone ?? '',
      },
    })

    await this.mailer.send({
      to: email,
      subject: `We received your enquiry about ${listing.title}`,
      template: 'enquiry-receipt',
      data: {
        listingTitle: listing.title,
        enquirerName: data.name,
      },
    })

    return this.enquiryWriter.markDelivered(enquiry.id, this.clock.now())
  }

  private listingUrl(slug: string): string {
    const base = this.deps.listingBaseUrl ?? 'https://doorstep.local'
    return `${base}/property/${slug}`
  }

  private async assertRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const result = await this.rateLimiter.consume(key, limit, windowSeconds)
    if (!result.allowed) {
      throw new RateLimitedError(result.resetAt)
    }
  }
}
