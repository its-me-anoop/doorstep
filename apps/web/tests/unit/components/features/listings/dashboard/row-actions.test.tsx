import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RowActions } from '@/components/features/listings/dashboard/row-actions'
import type { Listing } from '@/ports/listing-repository'

const changeListingStatusMock = vi.fn()
const deleteListingMock = vi.fn()
vi.mock('@/lib/listings-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/listings-client')>(
    '@/lib/listings-client',
  )
  return {
    ...actual,
    changeListingStatus: (...args: unknown[]) =>
      changeListingStatusMock(...args),
    deleteListing: (...args: unknown[]) => deleteListingMock(...args),
  }
})

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'draft',
    propertyType: 'flat',
    title: 'Flat for sale',
    slug: 'flat-abc123',
    description: '',
    features: [],
    bedrooms: 2,
    bathrooms: 1,
    price: 250_000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '12 Oxford Road',
    displayAddress: '12 Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.45, lng: -0.98 },
    locationApproximate: false,
    publishedAt: null,
    statusChangedAt: new Date('2026-08-01T00:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function renderRowActions(overrides: Partial<Listing> = {}) {
  const onListingChange = vi.fn()
  const onDeleted = vi.fn()
  render(
    <RowActions
      listing={listing(overrides)}
      onListingChange={onListingChange}
      onDeleted={onDeleted}
    />,
  )
  return { onListingChange, onDeleted }
}

// M1-DESIGN-SPEC.md §4.3 (action matrix) / §4.4 (optimistic + undo +
// delete confirm).
describe('RowActions', () => {
  beforeEach(() => {
    changeListingStatusMock.mockReset()
    deleteListingMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('action matrix per status', () => {
    it('draft: Continue editing + Delete draft', () => {
      renderRowActions({ status: 'draft' })

      expect(
        screen.getByRole('link', { name: 'Continue editing' }),
      ).toHaveAttribute('href', '/lister/listings/listing-1/edit')
      expect(
        screen.getByRole('button', { name: 'Delete draft' }),
      ).toBeInTheDocument()
    })

    it('pending_review: an inline note, no action buttons', () => {
      renderRowActions({
        status: 'pending_review',
        statusChangedAt: new Date('2026-08-01T00:00:00Z'),
      })

      expect(
        screen.getByText(/In review since 1 August 2026/),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('rejected: Edit and resubmit', () => {
      renderRowActions({ status: 'rejected' })

      expect(
        screen.getByRole('link', { name: 'Edit and resubmit' }),
      ).toHaveAttribute('href', '/lister/listings/listing-1/edit')
    })

    it('published sale: Mark Sold STC, Hide, Edit', () => {
      renderRowActions({ status: 'published', channel: 'sale' })

      expect(
        screen.getByRole('button', { name: 'Mark Sold STC' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        '/lister/listings/listing-1/edit',
      )
    })

    it('published rent: Mark Let Agreed instead', () => {
      renderRowActions({ status: 'published', channel: 'rent' })

      expect(
        screen.getByRole('button', { name: 'Mark Let Agreed' }),
      ).toBeInTheDocument()
    })

    it('under_offer sale: Mark Sold, Back on market, Edit', () => {
      renderRowActions({ status: 'under_offer', channel: 'sale' })

      expect(
        screen.getByRole('button', { name: 'Mark Sold' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Back on market' }),
      ).toBeInTheDocument()
    })

    it('under_offer rent: Mark Let', () => {
      renderRowActions({ status: 'under_offer', channel: 'rent' })

      expect(
        screen.getByRole('button', { name: 'Mark Let' }),
      ).toBeInTheDocument()
    })

    it('completed: a terminal note, no buttons', () => {
      renderRowActions({ status: 'completed' })

      expect(
        screen.getByText('Archived automatically after 90 days.'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('hidden: Unhide, Edit, and the auto-removal note', () => {
      renderRowActions({ status: 'hidden' })

      expect(screen.getByRole('button', { name: 'Unhide' })).toBeInTheDocument()
      expect(
        screen.getByText(
          'Hidden listings are removed automatically after 6 months if not unhidden.',
        ),
      ).toBeInTheDocument()
    })

    it('archived: no lister actions', () => {
      renderRowActions({ status: 'archived' })

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('optimistic paint + undo (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('Hide paints the row hidden immediately and offers a 6s Undo', async () => {
      changeListingStatusMock.mockReturnValue(new Promise(() => {}))
      const { onListingChange } = renderRowActions({
        status: 'published',
        channel: 'sale',
      })

      fireEvent.click(screen.getByRole('button', { name: 'Hide' }))

      expect(onListingChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'hidden' }),
      )
      expect(changeListingStatusMock).toHaveBeenCalledWith('listing-1', 'hide')
      expect(screen.getByText('Hidden from search.')).toBeInTheDocument()
      const undoButton = screen.getByRole('button', { name: 'Undo' })
      expect(undoButton).toBeInTheDocument()

      // Clicking Undo fires the inverse as a second real request.
      changeListingStatusMock.mockReturnValue(new Promise(() => {}))
      fireEvent.click(undoButton)
      expect(changeListingStatusMock).toHaveBeenCalledWith(
        'listing-1',
        'unhide',
      )
      expect(onListingChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published' }),
      )
    })

    it('the undo strip fades back to the normal action row after 6s', () => {
      changeListingStatusMock.mockReturnValue(new Promise(() => {}))
      renderRowActions({ status: 'published', channel: 'sale' })

      fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
      expect(screen.getByText('Hidden from search.')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(6000)
      })

      expect(screen.queryByText('Hidden from search.')).not.toBeInTheDocument()
    })

    it('Mark Sold has no Undo (complete has no legal inverse) and fades after 2s', () => {
      changeListingStatusMock.mockReturnValue(new Promise(() => {}))
      renderRowActions({ status: 'under_offer', channel: 'sale' })

      fireEvent.click(screen.getByRole('button', { name: 'Mark Sold' }))

      expect(screen.getByText('Marked sold.')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Undo' }),
      ).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.queryByText('Marked sold.')).not.toBeInTheDocument()
    })

    it('rolls back and shows a retry control when the request fails', async () => {
      changeListingStatusMock.mockRejectedValue(new Error('boom'))
      const { onListingChange } = renderRowActions({
        status: 'published',
        channel: 'sale',
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
        await vi.runAllTimersAsync()
      })

      expect(
        screen.getByText('Couldn’t update — try again.'),
      ).toBeInTheDocument()
      expect(onListingChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'published' }),
      )

      changeListingStatusMock.mockReturnValue(new Promise(() => {}))
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(changeListingStatusMock).toHaveBeenLastCalledWith(
        'listing-1',
        'hide',
      )
    })
  })

  describe('delete-draft inline confirm flow', () => {
    it('clicking Delete draft swaps to the inline confirm, Cancel returns to normal', () => {
      renderRowActions({ status: 'draft' })

      fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }))

      expect(
        screen.getByText(/Delete this draft\? This can.t be undone\./),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })

      fireEvent.click(cancelButton)

      expect(
        screen.getByRole('button', { name: 'Delete draft' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Delete' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Cancel' }),
      ).not.toBeInTheDocument()
    })

    it('confirming Delete calls the DELETE endpoint and reports the removed id', async () => {
      deleteListingMock.mockResolvedValue(undefined)
      const { onDeleted } = renderRowActions({ status: 'draft' })

      fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() =>
        expect(deleteListingMock).toHaveBeenCalledWith('listing-1'),
      )
      expect(onDeleted).toHaveBeenCalledWith('listing-1')
    })

    it('a failed delete shows a retryable error, without removing the row', async () => {
      deleteListingMock.mockRejectedValue(new Error('boom'))
      const { onDeleted } = renderRowActions({ status: 'draft' })

      fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

      await waitFor(() =>
        expect(
          screen.getByText(
            'Something went wrong on our end — try again in a moment.',
          ),
        ).toBeInTheDocument(),
      )
      expect(onDeleted).not.toHaveBeenCalled()
    })
  })
})
