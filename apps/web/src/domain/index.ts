/**
 * domain/
 *
 * Entities, value objects, the listing status state machine, and business
 * policies. Pure TypeScript. Zero framework imports — no Next.js, React,
 * Drizzle, Firebase, or any adapter. Everything here must be importable and
 * testable in plain Node with in-memory fakes only.
 *
 * See PRD §8.5 (layered architecture) and §9.3 (listing lifecycle).
 */

export type {
  Channel,
  PropertyStatus,
  PropertyType,
  PriceQualifier,
  Tenure,
  Furnished,
  EpcRating,
  CouncilTaxBand,
  UserRole,
  UserStatus,
  EnquiryStatus,
  ImageKind,
  AlertFrequency,
  OutboxOp,
} from './enums'
export { USER_ROLES, isUserRole, IMAGE_KINDS } from './enums'

export {
  InvalidTransitionError,
  canTransition,
  assertTransition,
} from './property-status-machine'

export { getDisplayStatus } from './display-status'
export { formatPrice } from './money'
export { milesToMetres } from './distance'
export type { FormatPriceInput } from './money'
export { slugify } from './slug'
export { generateListingTitle, generateListingSlug } from './listing-copy'
export type {
  GenerateListingTitleInput,
  GenerateListingSlugInput,
} from './listing-copy'
export {
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_CONTENT_TYPES,
  isAllowedImageContentType,
} from './image-upload-policy'
export type { AllowedImageContentType } from './image-upload-policy'
export { originalImagePath, variantImagePath } from './image-storage-path'
export type { ImageVariantFormat } from './image-storage-path'
export { planImageVariants } from './image-variant-plan'
export type { ImageVariantPlanEntry } from './image-variant-plan'
export { computeBlurhash } from './blurhash'

export type { UserEntity } from './user'
export type { PropertyEntity, GeoPoint } from './property'
export type { AgencyEntity } from './agency'
export type { PropertyImageEntity } from './property-image'
export type { EnquiryEntity } from './enquiry'
export type {
  SavedPropertyEntity,
  SavedSearchEntity,
  SavedSearchCriteria,
} from './saved'
export type { PaymentEntity, PaymentPurpose } from './payment'
export type { AuditLogEntity } from './audit-log'
export type { OutboxEntity } from './outbox'
export type { EventEntity } from './event'
