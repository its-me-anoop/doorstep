/** phase 2, schema reserved — the `payments` entity (PRD §9.2). */
export type PaymentPurpose = 'subscription' | 'featured_listing'

export interface PaymentEntity {
  id: string
  userId: string
  agencyId: string | null
  purpose: PaymentPurpose
  stripeCustomerId: string
  stripeRef: string
  amount: number
  currency: string
  status: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}
