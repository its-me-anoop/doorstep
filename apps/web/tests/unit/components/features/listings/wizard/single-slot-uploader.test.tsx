import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const requestImageUploadMock = vi.fn()
const uploadOriginalBytesMock = vi.fn()
const processListingImageMock = vi.fn()
const setListingImageKindMock = vi.fn()
const deleteListingImageMock = vi.fn()

vi.mock('@/lib/images-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/images-client')>(
    '@/lib/images-client',
  )
  return {
    ...actual,
    requestImageUpload: (...args: unknown[]) => requestImageUploadMock(...args),
    uploadOriginalBytes: (...args: unknown[]) =>
      uploadOriginalBytesMock(...args),
    processListingImage: (...args: unknown[]) =>
      processListingImageMock(...args),
    setListingImageKind: (...args: unknown[]) =>
      setListingImageKindMock(...args),
    deleteListingImage: (...args: unknown[]) => deleteListingImageMock(...args),
  }
})

import { SingleSlotUploader } from '@/components/features/listings/wizard/single-slot-uploader'
import type { ListingImage } from '@/lib/images-client'

function image(overrides: Partial<ListingImage> = {}): ListingImage {
  return {
    id: 'img-1',
    propertyId: 'listing-1',
    kind: 'floorplan',
    position: 0,
    width: 400,
    height: 300,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    urls: [{ width: 400, format: 'webp', url: 'https://cdn.test/400.webp' }],
    ...overrides,
  }
}

function jpegFile(name = 'floorplan.jpg'): File {
  return new File(['x'], name, { type: 'image/jpeg' })
}

describe('SingleSlotUploader', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows an "Add" affordance when the slot is empty', () => {
    render(
      <SingleSlotUploader
        listingId="listing-1"
        kind="floorplan"
        label="floorplan"
        image={undefined}
        onImageAdded={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    expect(screen.getByText('Add floorplan')).toBeInTheDocument()
  })

  it('shows the thumbnail with Change/Remove when the slot is filled', () => {
    render(
      <SingleSlotUploader
        listingId="listing-1"
        kind="epc"
        label="EPC certificate"
        image={image({ id: 'img-epc', kind: 'epc' })}
        onImageAdded={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.test/400.webp',
    )
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('uploads, processes and tags the image with the slot kind, then calls onImageAdded', async () => {
    requestImageUploadMock.mockResolvedValue({
      imageId: 'img-new',
      uploadUrl: 'https://storage.example/signed',
      path: 'p',
    })
    uploadOriginalBytesMock.mockResolvedValue(undefined)
    processListingImageMock.mockResolvedValue(
      image({ id: 'img-new', kind: 'photo' }),
    )
    const tagged = image({ id: 'img-new', kind: 'floorplan' })
    setListingImageKindMock.mockResolvedValue(tagged)
    const onImageAdded = vi.fn()

    render(
      <SingleSlotUploader
        listingId="listing-1"
        kind="floorplan"
        label="floorplan"
        image={undefined}
        onImageAdded={onImageAdded}
        onImageRemoved={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Add floorplan'), {
      target: { files: [jpegFile()] },
    })

    await waitFor(() =>
      expect(setListingImageKindMock).toHaveBeenCalledWith(
        'listing-1',
        'img-new',
        'floorplan',
      ),
    )
    expect(onImageAdded).toHaveBeenCalledWith(tagged)
  })

  it('replacing an existing slot image deletes the old one after the new one is tagged', async () => {
    const previous = image({ id: 'img-old', kind: 'floorplan' })
    requestImageUploadMock.mockResolvedValue({
      imageId: 'img-new',
      uploadUrl: 'https://storage.example/signed',
      path: 'p',
    })
    uploadOriginalBytesMock.mockResolvedValue(undefined)
    processListingImageMock.mockResolvedValue(image({ id: 'img-new' }))
    setListingImageKindMock.mockResolvedValue(
      image({ id: 'img-new', kind: 'floorplan' }),
    )
    deleteListingImageMock.mockResolvedValue(undefined)
    const onImageRemoved = vi.fn()

    render(
      <SingleSlotUploader
        listingId="listing-1"
        kind="floorplan"
        label="floorplan"
        image={previous}
        onImageAdded={vi.fn()}
        onImageRemoved={onImageRemoved}
      />,
    )

    fireEvent.change(screen.getByLabelText('Change floorplan'), {
      target: { files: [jpegFile()] },
    })

    await waitFor(() =>
      expect(deleteListingImageMock).toHaveBeenCalledWith(
        'listing-1',
        'img-old',
      ),
    )
    expect(onImageRemoved).toHaveBeenCalledWith('img-old')
  })

  it('Remove deletes the slot image and calls onImageRemoved', async () => {
    deleteListingImageMock.mockResolvedValue(undefined)
    const onImageRemoved = vi.fn()

    render(
      <SingleSlotUploader
        listingId="listing-1"
        kind="epc"
        label="EPC certificate"
        image={image({ id: 'img-epc', kind: 'epc' })}
        onImageAdded={vi.fn()}
        onImageRemoved={onImageRemoved}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(deleteListingImageMock).toHaveBeenCalledWith(
        'listing-1',
        'img-epc',
      ),
    )
    expect(onImageRemoved).toHaveBeenCalledWith('img-epc')
  })

  it('rejects a wrong-type file inline without calling requestImageUpload', async () => {
    render(
      <SingleSlotUploader
        listingId="listing-1"
        kind="floorplan"
        label="floorplan"
        image={undefined}
        onImageAdded={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Add floorplan'), {
      target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] },
    })

    expect(
      await screen.findByText(
        "That file isn't a photo Doorstep can use — try a JPEG or PNG.",
      ),
    ).toBeInTheDocument()
    expect(requestImageUploadMock).not.toHaveBeenCalled()
  })
})
