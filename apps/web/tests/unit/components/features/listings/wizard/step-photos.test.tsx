import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const photoGridPropsSpy = vi.fn()
vi.mock('@/components/features/listings/wizard/photo-grid', () => ({
  PhotoGrid: (props: Record<string, unknown>) => {
    photoGridPropsSpy(props)
    return <div data-testid="photo-grid" />
  },
}))

const slotPropsSpy = vi.fn()
vi.mock('@/components/features/listings/wizard/single-slot-uploader', () => ({
  SingleSlotUploader: (props: Record<string, unknown>) => {
    slotPropsSpy(props)
    return <div data-testid={`slot-${props.kind as string}`} />
  },
}))

import { StepPhotos } from '@/components/features/listings/wizard/step-photos'
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
    urls: [],
    ...overrides,
  }
}

// M1-DESIGN-SPEC.md §3.5/§1.5.
describe('StepPhotos', () => {
  it('names all three subsections as real h3 elements', () => {
    render(
      <StepPhotos
        listingId="listing-1"
        images={[]}
        status="ready"
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { level: 3, name: 'Photos' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Floorplan' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'EPC certificate' }),
    ).toBeInTheDocument()
  })

  it('passes only kind:photo images to PhotoGrid, sorted or not (PhotoGrid sorts)', () => {
    const photo1 = image({ id: 'p1', kind: 'photo' })
    const floorplan = image({ id: 'f1', kind: 'floorplan' })
    const epc = image({ id: 'e1', kind: 'epc' })

    render(
      <StepPhotos
        listingId="listing-1"
        images={[photo1, floorplan, epc]}
        status="ready"
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    expect(photoGridPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ photos: [photo1] }),
    )
  })

  it('passes the single floorplan/epc image (if any) to each slot uploader', () => {
    const floorplan = image({ id: 'f1', kind: 'floorplan' })
    const epc = image({ id: 'e1', kind: 'epc' })

    render(
      <StepPhotos
        listingId="listing-1"
        images={[floorplan, epc]}
        status="ready"
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    expect(slotPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'floorplan', image: floorplan }),
    )
    expect(slotPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'epc', image: epc }),
    )
  })

  it('explains the EPC rating/certificate distinction, correctly pointing back to the Details step', () => {
    render(
      <StepPhotos
        listingId="listing-1"
        images={[]}
        status="ready"
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    expect(screen.getByText(/details step/i)).toBeInTheDocument()
  })
})
