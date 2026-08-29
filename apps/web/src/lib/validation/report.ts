/**
 * Zod schemas for listing reports (PRD §6.6 ADM-2).
 */

import { z } from 'zod'

export const submitReportSchema = z.object({
  propertyId: z.string().trim().min(1, 'Invalid listing reference.'),
  reason: z.string().trim().min(1, 'Select a reason.'),
  details: z
    .string()
    .trim()
    .max(2000, 'Details are too long.')
    .optional()
    .nullable()
    .transform((value) => (value === '' ? null : value ?? null)),
})

export type SubmitReportInput = z.infer<typeof submitReportSchema>
