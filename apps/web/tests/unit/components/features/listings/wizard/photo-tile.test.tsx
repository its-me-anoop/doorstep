import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PhotoTile } from '@/components/features/listings/wizard/photo-tile'
import type { ListingImage } from '@/lib/images-client'

function image(overrides: Partial<ListingImage> = {}): ListingImage {
  return {
    id: 'img-1',
    propertyId: 'listing-1',
    kind: 'photo',
    position: 0,
    width: 400,
    height: 300,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    urls: [{ width: 400, format: 'webp', url: 'https://cdn.test/400.webp' }],
    ...overrides,
  }
}

// M1-DESIGN-SPEC.md §1.5.
describe('PhotoTile', () => {
  it('a ready tile at the cover position shows the Cover badge and no "Make cover" action', () => {
    render(
      <PhotoTile
        item={{ status: 'ready', image: image({ position: 0 }) }}
        isCover
        canMoveEarlier={false}
        canMoveLater
        onMakeCover={vi.fn()}
        onMoveEarlier={vi.fn()}
        onMoveLater={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.getByText('Cover')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Make cover' }),
    ).not.toBeInTheDocument()
  })

  it('a ready tile not at the cover position offers "Make cover" and calls it on click', () => {
    const onMakeCover = vi.fn()
    render(
      <PhotoTile
        item={{ status: 'ready', image: image({ position: 1 }) }}
        isCover={false}
        canMoveEarlier
        canMoveLater
        onMakeCover={onMakeCover}
        onMoveEarlier={vi.fn()}
        onMoveLater={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Make cover' }))
    expect(onMakeCover).toHaveBeenCalled()
  })

  it('Move earlier / Move later call their handlers and are disabled at the ends', () => {
    const onMoveEarlier = vi.fn()
    const onMoveLater = vi.fn()
    render(
      <PhotoTile
        item={{ status: 'ready', image: image({ position: 1 }) }}
        isCover={false}
        canMoveEarlier
        canMoveLater={false}
        onMakeCover={vi.fn()}
        onMoveEarlier={onMoveEarlier}
        onMoveLater={onMoveLater}
        onRemove={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Move earlier' }))
    expect(onMoveEarlier).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Move later' })).toBeDisabled()
  })

  it('Remove calls its handler', () => {
    const onRemove = vi.fn()
    render(
      <PhotoTile
        item={{ status: 'ready', image: image() }}
        isCover
        canMoveEarlier={false}
        canMoveLater={false}
        onMakeCover={vi.fn()}
        onMoveEarlier={vi.fn()}
        onMoveLater={vi.fn()}
        onRemove={onRemove}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalled()
  })

  it('an uploading tile shows a progressbar reflecting the given progress', () => {
    render(
      <PhotoTile
        item={{
          status: 'uploading',
          tempId: 'temp-1',
          fileName: 'kitchen.jpg',
          progress: 0.4,
        }}
        isCover={false}
        canMoveEarlier={false}
        canMoveLater={false}
      />,
    )

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '40')
  })

  it('a processing tile carries the reduced-motion-only "Processing…" label', () => {
    render(
      <PhotoTile
        item={{
          status: 'processing',
          tempId: 'temp-1',
          fileName: 'kitchen.jpg',
        }}
        isCover={false}
        canMoveEarlier={false}
        canMoveLater={false}
      />,
    )

    expect(screen.getByText('Processing…')).toBeInTheDocument()
  })

  it('an error tile shows the message and a Retry button that calls its handler', () => {
    const onRetry = vi.fn()
    render(
      <PhotoTile
        item={{
          status: 'error',
          tempId: 'temp-1',
          fileName: 'kitchen.jpg',
          message: "Couldn't upload — try again",
        }}
        isCover={false}
        canMoveEarlier={false}
        canMoveLater={false}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText("Couldn't upload — try again")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('a ready tile is draggable and reports drag start/over/drop', () => {
    const onDragStart = vi.fn()
    const onDropOnto = vi.fn()
    render(
      <PhotoTile
        item={{ status: 'ready', image: image() }}
        isCover
        canMoveEarlier={false}
        canMoveLater={false}
        onDragStart={onDragStart}
        onDropOnto={onDropOnto}
      />,
    )

    const tile = screen.getByTestId('photo-tile')
    expect(tile).toHaveAttribute('draggable', 'true')
    fireEvent.dragStart(tile)
    expect(onDragStart).toHaveBeenCalled()
    fireEvent.drop(tile)
    expect(onDropOnto).toHaveBeenCalled()
  })
})
