import { describe, expect, it, vi } from 'vitest'

import {
  createClusterElement,
  formatClusterCount,
} from '@/components/features/search/map/cluster-marker'

// M3-DESIGN-SPEC.md §1.3 — the three-step cluster badge.
describe('formatClusterCount', () => {
  it('shows the exact count up to 200', () => {
    expect(formatClusterCount(1)).toBe('1')
    expect(formatClusterCount(37)).toBe('37')
    expect(formatClusterCount(200)).toBe('200')
  })

  it('caps display at "200+" above 200, a display-only cap', () => {
    expect(formatClusterCount(201)).toBe('200+')
    expect(formatClusterCount(5000)).toBe('200+')
  })
})

describe('createClusterElement', () => {
  it('applies the small size step under 10', () => {
    const handle = createClusterElement(9, vi.fn())
    const cluster = handle.element.querySelector('.cluster')
    expect(cluster?.classList.contains('cluster--small')).toBe(true)
    expect(cluster?.textContent).toBe('9')
  })

  it('applies the medium size step from 10 to 99', () => {
    expect(
      createClusterElement(10, vi.fn())
        .element.querySelector('.cluster')
        ?.classList.contains('cluster--medium'),
    ).toBe(true)
    expect(
      createClusterElement(99, vi.fn())
        .element.querySelector('.cluster')
        ?.classList.contains('cluster--medium'),
    ).toBe(true)
  })

  it('applies the large size step from 100 up', () => {
    expect(
      createClusterElement(100, vi.fn())
        .element.querySelector('.cluster')
        ?.classList.contains('cluster--large'),
    ).toBe(true)
    expect(
      createClusterElement(5000, vi.fn()).element.querySelector('.cluster')
        ?.textContent,
    ).toBe('200+')
  })

  it('is hidden from the accessibility tree and out of the tab order, same as a pin', () => {
    const cluster = createClusterElement(12, vi.fn()).element.querySelector(
      '.cluster',
    )
    expect(cluster?.getAttribute('aria-hidden')).toBe('true')
    expect((cluster as HTMLElement).tabIndex).toBe(-1)
  })

  it('calls onSelect when clicked without letting the click reach the map', () => {
    const onSelect = vi.fn()
    const handle = createClusterElement(12, onSelect)
    const parentClick = vi.fn()
    handle.element.addEventListener('click', parentClick)

    handle.element
      .querySelector('.cluster')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(parentClick).not.toHaveBeenCalled()
  })
})
