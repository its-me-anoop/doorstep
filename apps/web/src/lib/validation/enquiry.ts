/**
 * Zod schemas for enquiry submission (PRD §6.4 ENQ-1/ENQ-2), shared between
 * the client form and services/enquiries/submit-enquiry.ts.
 */

import { z } from 'zod'

const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(
    z.email("That email address doesn't look quite right — check for typos."),
  )

export const submitEnquirySchema = z.object({
  propertyId: z.string().trim().min(1, 'Invalid listing reference.'),
  name: z.string().trim().min(1, 'Enter your name.'),
  email: emailField,
  phone: z
    .string()
    .trim()
    .max(30, 'Phone number is too long.')
    .optional()
    .nullable()
    .transform((value) => (value === '' ? null : (value ?? null))),
  message: z
    .string()
    .trim()
    .min(10, 'Tell the lister a bit more — at least 10 characters.')
    .max(4000, 'Message is too long.'),
  viewingRequested: z.boolean().default(false),
  /** Honeypot — must stay empty; bots that fill it are rejected silently. */
  website: z.string().optional().default(''),
})

export type SubmitEnquiryInput = z.infer<typeof submitEnquirySchema>
