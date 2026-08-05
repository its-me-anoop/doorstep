import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const requestImageUploadMock = vi.fn()
const uploadOriginalBytesMock = vi.fn()
const processListingImageMock = vi.fn()
const setListingImagePositionMock = vi.fn()
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
    setListingImagePosition: (...args: unknown[]) =>
      setListingImagePositionMock(...args),
    deleteListingImage: (...args: unknown[]) => deleteListingImageMock(...args),
  }
})

import { PhotoGrid } from '@/components/features/listings/wizard/photo-grid'
import { ImagesApiError, type ListingImage } from '@/lib/images-client'
import { MAX_IMAGES_PER_LISTING } from '@/domain'

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

function jpegFile(name = 'kitchen.jpg', size = 1024): File {
  const file = new File(['x'.repeat(size)], name, { type: 'image/jpeg' })
  return file
}

function selectFiles(files: File[]) {
  const input = screen.getByLabelText(/add photos/i, {
    selector: 'input',
  }) as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

describe('PhotoGrid', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows the teaching empty state when there are no photos yet', () => {
    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[]}
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    expect(screen.getByText(/add photos of every room/i)).toBeInTheDocument()
  })

  it('runs the 3-call upload pipeline in order with the right payloads, then adds the image', async () => {
    requestImageUploadMock.mockResolvedValue({
      imageId: 'img-new',
      uploadUrl: 'https://storage.example/signed',
      path: 'listings/listing-1/original/img-new',
      headers: { 'Content-Type': 'image/jpeg' },
    })
    uploadOriginalBytesMock.mockResolvedValue(undefined)
    const processed = image({ id: 'img-new', position: 0 })
    processListingImageMock.mockResolvedValue(processed)
    const onImageAdded = vi.fn()

    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[]}
        onImageAdded={onImageAdded}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    const file = jpegFile()
    selectFiles([file])

    await waitFor(() => expect(onImageAdded).toHaveBeenCalledWith(processed))

    expect(requestImageUploadMock).toHaveBeenCalledWith('listing-1', {
      contentType: 'image/jpeg',
      bytes: file.size,
    })
    expect(uploadOriginalBytesMock).toHaveBeenCalledWith(
      'https://storage.example/signed',
      file,
      expect.objectContaining({ headers: { 'Content-Type': 'image/jpeg' } }),
    )
    expect(processListingImageMock).toHaveBeenCalledWith('listing-1', 'img-new')

    // Call order: request, then PUT, then process.
    const requestOrder = [
      requestImageUploadMock.mock.invocationCallOrder[0],
      uploadOriginalBytesMock.mock.invocationCallOrder[0],
      processListingImageMock.mock.invocationCallOrder[0],
    ]
    expect(requestOrder).toEqual([...requestOrder].sort((a, b) => a - b))
  })

  it('rejects a wrong-type file inline without calling requestImageUpload', async () => {
    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[]}
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    const gif = new File(['x'], 'a.gif', { type: 'image/gif' })
    selectFiles([gif])

    expect(
      await screen.findByText(
        "That file isn't a photo Doorstep can use — try a JPEG or PNG.",
      ),
    ).toBeInTheDocument()
    expect(requestImageUploadMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized file inline without calling requestImageUpload', async () => {
    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[]}
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    const huge = jpegFile('huge.jpg', 16 * 1024 * 1024)
    selectFiles([huge])

    expect(
      await screen.findByText(/doorstep accepts up to 15mb/i),
    ).toBeInTheDocument()
    expect(requestImageUploadMock).not.toHaveBeenCalled()
  })

  it('shows an inline error with Retry when the upload pipeline rejects, and Retry re-runs it', async () => {
    requestImageUploadMock.mockResolvedValueOnce({
      imageId: 'img-new',
      uploadUrl: 'https://storage.example/signed',
      path: 'listings/listing-1/original/img-new',
    })
    uploadOriginalBytesMock.mockRejectedValueOnce(
      new ImagesApiError('internal_error', 'Upload failed with status 403'),
    )
    const onImageAdded = vi.fn()

    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[]}
        onImageAdded={onImageAdded}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    selectFiles([jpegFile()])

    const retryButton = await screen.findByRole('button', { name: 'Retry' })

    requestImageUploadMock.mockResolvedValueOnce({
      imageId: 'img-new',
      uploadUrl: 'https://storage.example/signed',
      path: 'listings/listing-1/original/img-new',
    })
    uploadOriginalBytesMock.mockResolvedValueOnce(undefined)
    const processed = image({ id: 'img-new' })
    processListingImageMock.mockResolvedValueOnce(processed)

    fireEvent.click(retryButton)

    await waitFor(() => expect(onImageAdded).toHaveBeenCalledWith(processed))
  })

  it('enforces the 25-photo cap: extra files beyond the remaining slots are not uploaded', async () => {
    const existing = Array.from(
      { length: MAX_IMAGES_PER_LISTING - 1 },
      (_, i) => image({ id: `img-${i}`, position: i }),
    )

    render(
      <PhotoGrid
        listingId="listing-1"
        photos={existing}
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    requestImageUploadMock.mockResolvedValue({
      imageId: 'img-new',
      uploadUrl: 'https://storage.example/signed',
      path: 'p',
    })
    uploadOriginalBytesMock.mockResolvedValue(undefined)
    processListingImageMock.mockResolvedValue(image({ id: 'img-new' }))

    selectFiles([jpegFile('a.jpg'), jpegFile('b.jpg')])

    await waitFor(() => expect(requestImageUploadMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/only 1 more photo/i)).toBeInTheDocument()
  })

  it('Move later on the cover image PATCHes both images’ positions and calls onImagesReplaced with both', async () => {
    const first = image({ id: 'img-1', position: 0 })
    const second = image({ id: 'img-2', position: 1 })
    setListingImagePositionMock.mockResolvedValue({ ...first, position: 1 })
    const onImagesReplaced = vi.fn()

    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[first, second]}
        onImageAdded={vi.fn()}
        onImagesReplaced={onImagesReplaced}
        onImageRemoved={vi.fn()}
      />,
    )

    const laterButtons = screen.getAllByRole('button', { name: 'Move later' })
    fireEvent.click(laterButtons[0]!)

    await waitFor(() =>
      expect(setListingImagePositionMock).toHaveBeenCalledWith(
        'listing-1',
        'img-1',
        1,
      ),
    )
    await waitFor(() =>
      expect(onImagesReplaced).toHaveBeenCalledWith([
        { ...first, position: 1 },
        { ...second, position: 0 },
      ]),
    )
  })

  it('drag-and-drop of one tile onto another swaps their positions via the same PATCH call', async () => {
    const first = image({ id: 'img-1', position: 0 })
    const second = image({ id: 'img-2', position: 1 })
    setListingImagePositionMock.mockResolvedValue({ ...second, position: 0 })

    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[first, second]}
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={vi.fn()}
      />,
    )

    const tiles = screen.getAllByTestId('photo-tile')
    fireEvent.dragStart(tiles[1]!)
    fireEvent.drop(tiles[0]!)

    await waitFor(() =>
      expect(setListingImagePositionMock).toHaveBeenCalledWith(
        'listing-1',
        'img-2',
        0,
      ),
    )
  })

  it('Remove calls deleteListingImage and onImageRemoved', async () => {
    const only = image({ id: 'img-1' })
    deleteListingImageMock.mockResolvedValue(undefined)
    const onImageRemoved = vi.fn()

    render(
      <PhotoGrid
        listingId="listing-1"
        photos={[only]}
        onImageAdded={vi.fn()}
        onImagesReplaced={vi.fn()}
        onImageRemoved={onImageRemoved}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(deleteListingImageMock).toHaveBeenCalledWith('listing-1', 'img-1'),
    )
    await waitFor(() => expect(onImageRemoved).toHaveBeenCalledWith('img-1'))
  })
})
