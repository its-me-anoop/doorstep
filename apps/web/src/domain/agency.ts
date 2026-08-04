/** The `agencies` entity (PRD §9.2). */
export interface AgencyEntity {
  id: string
  name: string
  slug: string
  logoPath: string | null
  phone: string
  email: string
  website: string
  address: string
  verified: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
