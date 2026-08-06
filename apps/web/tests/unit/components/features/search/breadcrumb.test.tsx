import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Breadcrumb } from '@/components/features/search/breadcrumb'

// M2-DESIGN-SPEC.md §3.1 point 1 — visible breadcrumb + the BreadcrumbList
// JSON-LD it doubles as (PRD §7.2).
describe('Breadcrumb', () => {
  it('renders every crumb, linking every one but the last', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'For sale', href: '/for-sale' },
          { label: 'RG1 8BT' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'For sale' })).toHaveAttribute(
      'href',
      '/for-sale',
    )
    expect(screen.getByText('RG1 8BT')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'RG1 8BT' }),
    ).not.toBeInTheDocument()
  })

  it('emits matching BreadcrumbList JSON-LD', () => {
    const { container } = render(
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }, { label: 'For sale' }]}
      />,
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script?.textContent ?? '{}')
    expect(data['@type']).toBe('BreadcrumbList')
    expect(data.itemListElement).toHaveLength(2)
    expect(data.itemListElement[0]).toMatchObject({
      position: 1,
      name: 'Home',
      item: '/',
    })
    expect(data.itemListElement[1]).toMatchObject({
      position: 2,
      name: 'For sale',
    })
  })
})
