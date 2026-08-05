import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

const createDraftListingMock = vi.fn()
vi.mock('@/lib/listings-client', () => ({
  createDraftListing: (...args: unknown[]) => createDraftListingMock(...args),
  ListingsApiError: class ListingsApiError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

import { ListingsApiError } from '@/lib/listings-client'

import { NewListingRedirect } from '@/components/features/listings/new-listing-redirect'

/**
 * The create-listing wizard's entry point (M1-DESIGN-SPEC.md §3): create
 * a draft, then route straight into the wizard shell at step 1. Its own
 * defaults (`channel: 'sale', propertyType: 'other'`) exist only to
 * satisfy draftListingSchema's two always-required fields — the wizard's
 * own step 1 is where the user actually makes that choice.
 */
describe('NewListingRedirect', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a draft with the minimal valid defaults, then routes to its edit page', async () => {
    createDraftListingMock.mockResolvedValue({ id: 'listing-1' })
    render(<NewListingRedirect />)

    await waitFor(() =>
      expect(createDraftListingMock).toHaveBeenCalledWith({
        channel: 'sale',
        propertyType: 'other',
      }),
    )
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        '/lister/listings/listing-1/edit',
      ),
    )
  })

  it('shows a quiet "setting up" message while the draft is being created', () => {
    createDraftListingMock.mockReturnValue(new Promise(() => {}))
    render(<NewListingRedirect />)

    expect(screen.getByText(/setting up your listing/i)).toBeInTheDocument()
  })

  it('on failure, shows a friendly error with a retry that tries again', async () => {
    createDraftListingMock.mockRejectedValueOnce(
      new ListingsApiError('internal_error', 'Something went wrong.'),
    )
    render(<NewListingRedirect />)

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()

    createDraftListingMock.mockResolvedValueOnce({ id: 'listing-2' })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        '/lister/listings/listing-2/edit',
      ),
    )
  })
})
