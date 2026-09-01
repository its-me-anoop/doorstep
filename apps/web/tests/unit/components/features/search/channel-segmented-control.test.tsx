import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChannelSegmentedControl } from '@/components/features/search/channel-segmented-control'

describe('ChannelSegmentedControl', () => {
  it('keeps "For sale" and "To rent" on one line each', () => {
    render(
      <ChannelSegmentedControl value="sale" onChange={vi.fn()} size="lg" />,
    )

    expect(
      screen.getByRole('button', { name: 'For sale' }).className,
    ).toContain('whitespace-nowrap')
    expect(screen.getByRole('button', { name: 'To rent' }).className).toContain(
      'whitespace-nowrap',
    )
  })
})
