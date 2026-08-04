/** The `events` entity — first-party analytics (PRD §9.2). */
export interface EventEntity {
  id: string
  name: string
  anonId: string
  userId: string | null
  properties: Record<string, unknown>
  createdAt: Date
}
