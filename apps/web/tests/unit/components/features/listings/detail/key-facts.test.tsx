import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { KeyFacts } from '@/components/features/listings/detail/key-facts'

// M2-DESIGN-SPEC.md §5.4 — a plain two-column definition list, channel
// aware (tenure vs furnished/available-from), optional rows (EPC,
// council tax) omitted entirely when absent rather than shown empty.
describe('KeyFacts', () => {
  it('renders the sale row set: price, beds, baths, type, tenure', () => {
    render(
      <KeyFacts
        channel="sale"
        price={350000}
        priceQualifier="guide_price"
        bedrooms={3}
        bathrooms={1}
        propertyType="semi_detached"
        tenure="freehold"
        furnished={null}
        availableFrom={null}
        epcRating={null}
        councilTaxBand={null}
        todayIso="2026-08-06"
      />,
    )
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Guide price £350,000')).toBeInTheDocument()
    expect(screen.getByText('Bedrooms')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Bathrooms')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Semi-detached house')).toBeInTheDocument()
    expect(screen.getByText('Tenure')).toBeInTheDocument()
    expect(screen.getByText('Freehold')).toBeInTheDocument()
  })

  it('omits Furnished/Available from for a sale listing', () => {
    render(
      <KeyFacts
        channel="sale"
        price={350000}
        priceQualifier="fixed"
        bedrooms={3}
        bathrooms={1}
        propertyType="flat"
        tenure="leasehold"
        furnished={null}
        availableFrom={null}
        epcRating={null}
        councilTaxBand={null}
        todayIso="2026-08-06"
      />,
    )
    expect(screen.queryByText('Furnished')).not.toBeInTheDocument()
    expect(screen.queryByText('Available from')).not.toBeInTheDocument()
  })

  it('renders the rent row set: rent, furnished, available from — not tenure', () => {
    render(
      <KeyFacts
        channel="rent"
        price={1200}
        priceQualifier="fixed"
        bedrooms={2}
        bathrooms={1}
        propertyType="flat"
        tenure={null}
        furnished="part_furnished"
        availableFrom="2026-09-01"
        epcRating={null}
        councilTaxBand={null}
        todayIso="2026-08-06"
      />,
    )
    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('£1,200 pcm')).toBeInTheDocument()
    expect(screen.getByText('Furnished')).toBeInTheDocument()
    expect(screen.getByText('Part-furnished')).toBeInTheDocument()
    expect(screen.getByText('Available from')).toBeInTheDocument()
    expect(screen.getByText('1 September 2026')).toBeInTheDocument()
    expect(screen.queryByText('Tenure')).not.toBeInTheDocument()
  })

  it('shows "Now" for an available-from date today or earlier', () => {
    render(
      <KeyFacts
        channel="rent"
        price={1200}
        priceQualifier="fixed"
        bedrooms={2}
        bathrooms={1}
        propertyType="flat"
        tenure={null}
        furnished="furnished"
        availableFrom="2026-08-01"
        epcRating={null}
        councilTaxBand={null}
        todayIso="2026-08-06"
      />,
    )
    expect(screen.getByText('Now')).toBeInTheDocument()
  })

  it('shows Studio for zero bedrooms', () => {
    render(
      <KeyFacts
        channel="sale"
        price={200000}
        priceQualifier="fixed"
        bedrooms={0}
        bathrooms={1}
        propertyType="flat"
        tenure="leasehold"
        furnished={null}
        availableFrom={null}
        epcRating={null}
        councilTaxBand={null}
        todayIso="2026-08-06"
      />,
    )
    expect(screen.getByText('Studio')).toBeInTheDocument()
  })

  it('shows EPC and council tax rows only when present', () => {
    render(
      <KeyFacts
        channel="sale"
        price={200000}
        priceQualifier="fixed"
        bedrooms={2}
        bathrooms={1}
        propertyType="flat"
        tenure="leasehold"
        furnished={null}
        availableFrom={null}
        epcRating="C"
        councilTaxBand="D"
        todayIso="2026-08-06"
      />,
    )
    expect(screen.getByText('EPC rating')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('Council tax band')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('omits EPC/council tax rows entirely when absent, not as an empty value', () => {
    render(
      <KeyFacts
        channel="sale"
        price={200000}
        priceQualifier="fixed"
        bedrooms={2}
        bathrooms={1}
        propertyType="flat"
        tenure="leasehold"
        furnished={null}
        availableFrom={null}
        epcRating={null}
        councilTaxBand={null}
        todayIso="2026-08-06"
      />,
    )
    expect(screen.queryByText('EPC rating')).not.toBeInTheDocument()
    expect(screen.queryByText('Council tax band')).not.toBeInTheDocument()
  })
})
