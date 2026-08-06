import { describe, expect, it, vi } from 'vitest'

import { createPinElement } from '@/components/features/search/map/pin-marker'

// M3-DESIGN-SPEC.md §1.2 — the single-listing pin. A pure DOM builder,
// deliberately independent of any real map instance so it's testable
// without one; the map adapter is the only thing that hands its
// `element` to `new maplibregl.Marker()`/`new mapboxgl.Marker()`.
describe('createPinElement', () => {
  it('renders the label text inside a .pin--default element for a published listing', () => {
    const handle = createPinElement(
      { label: '£350k', underOffer: false },
      vi.fn(),
    )
    const pin = handle.element.querySelector('.pin')
    expect(pin?.textContent).toBe('£350k')
    expect(pin?.classList.contains('pin--default')).toBe(true)
    expect(pin?.classList.contains('pin--underoffer')).toBe(false)
  })

  it('renders .pin--underoffer for an under-offer listing', () => {
    const handle = createPinElement(
      { label: 'Sold STC', underOffer: true },
      vi.fn(),
    )
    const pin = handle.element.querySelector('.pin')
    expect(pin?.classList.contains('pin--underoffer')).toBe(true)
    expect(pin?.classList.contains('pin--default')).toBe(false)
  })

  // §4: pins are never in the tab order and are hidden from the
  // accessibility tree — the list is the accessible path.
  it('is hidden from the accessibility tree and out of the tab order', () => {
    const handle = createPinElement(
      { label: '£350k', underOffer: false },
      vi.fn(),
    )
    const pin = handle.element.querySelector('.pin')
    expect(pin?.getAttribute('aria-hidden')).toBe('true')
    expect((pin as HTMLElement).tabIndex).toBe(-1)
  })

  it('calls onSelect when clicked, and does not let the click bubble to the map', () => {
    const onSelect = vi.fn()
    const handle = createPinElement(
      { label: '£350k', underOffer: false },
      onSelect,
    )
    const parentClick = vi.fn()
    document.body.appendChild(handle.element)
    handle.element.addEventListener('click', parentClick)

    handle.element
      .querySelector('.pin')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(parentClick).not.toHaveBeenCalled()
    document.body.removeChild(handle.element)
  })

  // §1.2's hover/paired-highlight state — applied to the inner pin, not
  // the outer wrapper the map library positions (see the module's own
  // doc comment for why).
  it('setActive toggles the pin--active class on the inner pin, not the outer wrapper', () => {
    const handle = createPinElement(
      { label: '£350k', underOffer: false },
      vi.fn(),
    )
    handle.setActive(true)
    expect(
      handle.element.querySelector('.pin')?.classList.contains('pin--active'),
    ).toBe(true)
    expect(handle.element.classList.contains('pin--active')).toBe(false)

    handle.setActive(false)
    expect(
      handle.element.querySelector('.pin')?.classList.contains('pin--active'),
    ).toBe(false)
  })
})
