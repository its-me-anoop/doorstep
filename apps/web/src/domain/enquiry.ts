import type { EnquiryStatus } from './enums'

/** The `enquiries` entity (PRD §9.2). */
export interface EnquiryEntity {
  id: string
  propertyId: string
  /** Null for guest enquiries. */
  senderId: string | null
  name: string
  email: string
  phone: string | null
  message: string
  viewingRequested: boolean
  status: EnquiryStatus
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}
