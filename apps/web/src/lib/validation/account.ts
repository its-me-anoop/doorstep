/**
 * Zod schemas for account settings (PRD §6.3 ACC-3).
 */

import { z } from 'zod'

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your name.'),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone number is too long.')
    .optional()
    .nullable()
    .transform((value) => (value === '' ? null : (value ?? null))),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
