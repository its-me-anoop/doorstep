import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CoverGallery } from '@/components/features/listings/detail/cover-gallery'
import type { PublicListingImage } from '@/services/listings/get-public-listing'

function image(
  overrides: Partial<PublicListingImage> = {},
): PublicListingImage {
  return {
    id: 'image-1',
    kind: 'photo',
    position: 0,
    width: 1600,
    height: 1200,
    blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
    altText: null,
    urls: [
      { width: 400, format: 'webp', url: 'https://cdn.test/image-1/400.webp' },
      { width: 800, format: 'webp', url: 'https://cdn.test/image-1/800.webp' },
      {
        width: 1600,
        format: 'webp',
        url: 'https://cdn.test/image-1/1600.webp',
      },
    ],
    ...overrides,
  }
}

// M2-DESIGN-SPEC.md §5.3 — cover + thumbnail strip, clicking a thumbnail
// swaps the cover in place (no lightbox, no new route — that's M4).
describe('CoverGallery', () => {
  it('renders the first image as the cover, using its widest variant', () => {
    render(
      <CoverGallery
        title="3 bed semi-detached house"
        images={[image({ id: 'image-1' })]}
      />,
    )
    expect(
      screen.getByRole('img', { name: '3 bed semi-detached house' }),
    ).toHaveAttribute('src', 'https://cdn.test/image-1/1600.webp')
  })

  it('uses the image altText over the listing title when set', () => {
    render(
      <CoverGallery
        title="3 bed semi-detached house"
        images={[image({ altText: 'Front of the house' })]}
      />,
    )
    expect(
      screen.getByRole('img', { name: 'Front of the house' }),
    ).toBeInTheDocument()
  })

  it('renders a thumbnail per image and swaps the cover on click', () => {
    render(
      <CoverGallery
        title="A home"
        images={[
          image({ id: 'image-1' }),
          image({
            id: 'image-2',
            position: 1,
            urls: [
              {
                width: 1600,
                format: 'webp',
                url: 'https://cdn.test/image-2/1600.webp',
              },
            ],
          }),
        ]}
      />,
    )

    const thumbnails = screen.getAllByRole('button')
    expect(thumbnails).toHaveLength(2)

    fireEvent.click(thumbnails[1])

    expect(screen.getByRole('img', { name: 'A home' })).toHaveAttribute(
      'src',
      'https://cdn.test/image-2/1600.webp',
    )
  })

  it('labels floorplan and EPC thumbnails', () => {
    render(
      <CoverGallery
        title="A home"
        images={[
          image({ id: 'image-1' }),
          image({ id: 'image-2', kind: 'floorplan', position: 1 }),
          image({ id: 'image-3', kind: 'epc', position: 2 }),
        ]}
      />,
    )
    expect(screen.getByText('Floorplan')).toBeInTheDocument()
    expect(screen.getByText('EPC certificate')).toBeInTheDocument()
  })

  it('marks the currently-shown thumbnail as pressed', () => {
    render(
      <CoverGallery
        title="A home"
        images={[
          image({ id: 'image-1' }),
          image({ id: 'image-2', position: 1 }),
        ]}
      />,
    )
    const thumbnails = screen.getAllByRole('button')
    expect(thumbnails[0]).toHaveAttribute('aria-pressed', 'true')
    expect(thumbnails[1]).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(thumbnails[1])

    expect(thumbnails[0]).toHaveAttribute('aria-pressed', 'false')
    expect(thumbnails[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders a flat placeholder, not a crash, when there are no images', () => {
    render(<CoverGallery title="A home" images={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
