import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LocationSection } from '@/components/features/listings/detail/location-section'

describe('LocationSection', () => {
  const geo = { lat: 51.454, lng: -0.978 }

  it('renders the "Location." heading and the display address', () => {
    render(
      <LocationSection displayAddress="Oxford Road, Reading, RG30" geo={geo} />,
    )
    expect(
      screen.getByRole('heading', { name: 'Location.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Oxford Road, Reading, RG30')).toBeInTheDocument()
  })

  it('renders an OpenStreetMap embed iframe', () => {
    render(
      <LocationSection displayAddress="Oxford Road, Reading, RG30" geo={geo} />,
    )
    const iframe = screen.getByTitle('Property location map')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('openstreetmap.org'))
  })

  it('notes approximate location when flagged', () => {
    render(
      <LocationSection
        displayAddress="Oxford Road, Reading, RG30"
        geo={geo}
        locationApproximate
      />,
    )
    expect(
      screen.getByText(/approximate location for privacy/i),
    ).toBeInTheDocument()
  })
})
