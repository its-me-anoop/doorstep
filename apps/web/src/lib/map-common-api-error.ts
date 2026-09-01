/**
 * Shared error-to-envelope mapping for M4–M6 API routes (PRD §8.5).
 * Extends mapCommonListingError with enquiry/saved/account/admin cases.
 */

import { NextResponse } from 'next/server'

import { EnquiryNotFoundError } from '@/ports/enquiry-repository'
import { ReportNotFoundError } from '@/ports/report-repository'
import { SavedSearchNotFoundError } from '@/ports/saved-search-repository'
import { ProfileValidationError } from '@/services/account/errors'
import {
  ListingDecisionValidationError,
  ReportValidationError,
  TargetUserNotFoundError,
  UserManagementValidationError,
} from '@/services/admin/errors'
import { SavedSearchForbiddenError } from '@/services/saved/errors'

import { apiError, type ApiErrorBody } from './api-error'
import { mapCommonListingError } from './listing-api-errors'

export function mapCommonApiError(
  error: unknown,
): NextResponse<ApiErrorBody> | null {
  const listing = mapCommonListingError(error)
  if (listing) return listing

  if (error instanceof EnquiryNotFoundError) {
    return apiError(404, 'not_found', error.message)
  }
  if (error instanceof SavedSearchNotFoundError) {
    return apiError(404, 'not_found', error.message)
  }
  if (error instanceof SavedSearchForbiddenError) {
    return apiError(403, 'forbidden', error.message)
  }
  if (error instanceof ReportNotFoundError) {
    return apiError(404, 'not_found', error.message)
  }
  if (error instanceof TargetUserNotFoundError) {
    return apiError(404, 'not_found', error.message)
  }
  if (error instanceof ProfileValidationError) {
    const message = error.issues[0]?.message ?? error.message
    return apiError(400, 'validation_error', message)
  }
  if (error instanceof ListingDecisionValidationError) {
    const message = error.issues[0]?.message ?? error.message
    return apiError(400, 'validation_error', message)
  }
  if (error instanceof ReportValidationError) {
    const message = error.issues[0]?.message ?? error.message
    return apiError(400, 'validation_error', message)
  }
  if (error instanceof UserManagementValidationError) {
    return apiError(400, 'validation_error', error.message)
  }

  return null
}
