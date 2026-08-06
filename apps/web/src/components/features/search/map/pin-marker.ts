/**
 * Builds the DOM for one single-listing pin (M3-DESIGN-SPEC.md §1.2) — a
 * plain, framework-free DOM builder rather than a React component,
 * because the map adapter hands this element straight to
 * `new maplibregl.Marker({ element })` / `new mapboxgl.Marker({ element,
 * anchor: 'bottom' })`, which is outside React's render tree entirely
 * (the map canvas is imperative, not declarative — see map-adapter.ts's
 * own doc comment). Pure and framework-free also makes this trivially
 * unit-testable in jsdom with no map library loaded at all.
 *
 * `element` (returned) is deliberately an *empty wrapper* around the
 * real pin, not the pin itself: MapLibre/Mapbox position a marker by
 * writing a `transform` inline style directly onto the element you hand
 * them (their own anchor/projection maths — `anchor: 'bottom'` gives
 * exactly §1.2's "the pill's own bottom edge is the anchor" without a
 * hand-rolled `translate(-50%, -100%)`), and an inline style always wins
 * over a stylesheet rule regardless of specificity. Putting the hover/
 * select `transform: scale(1.12)` (§1.2) directly on that same element
 * would fight the library's own positioning transform every time either
 * one changes. The inner `.pin` div is untouched by the library and free
 * to own its own transform/transition.
 */

export interface PinFeatureProperties {
  label: string
  underOffer: boolean
}

export interface PinHandle {
  /** Hand this straight to the map library's `Marker` constructor. */
  element: HTMLDivElement
  /** §1.2/§1.6's cross-highlight state — `transform: scale(1.12)`,
   * transform-only, no layout shift. */
  setActive: (active: boolean) => void
}

export function createPinElement(
  properties: PinFeatureProperties,
  onSelect: () => void,
): PinHandle {
  const root = document.createElement('div')

  const pin = document.createElement('div')
  pin.className = `pin ${properties.underOffer ? 'pin--underoffer' : 'pin--default'}`
  pin.textContent = properties.label

  // §4: individual pins are never in the tab order and are hidden from
  // the accessibility tree — the result list (real, focusable `<a>`
  // cards, one per listing) is the accessible path, and every pin's
  // content is fully duplicated there, so this costs nothing.
  pin.setAttribute('aria-hidden', 'true')
  pin.tabIndex = -1

  pin.addEventListener('click', (event) => {
    // Stops the click reaching the map canvas underneath, which would
    // otherwise also fire the map's own click handling (e.g. dismissing
    // whatever mini card this very click is trying to open).
    event.stopPropagation()
    onSelect()
  })

  root.appendChild(pin)

  return {
    element: root,
    setActive: (active) => pin.classList.toggle('pin--active', active),
  }
}
