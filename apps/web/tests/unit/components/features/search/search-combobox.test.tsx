import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const geocodeSearchMock = vi.fn()
vi.mock('@/lib/listings-client', () => ({
  geocodeSearch: (...args: unknown[]) => geocodeSearchMock(...args),
}))

import { SearchCombobox } from '@/components/features/search/search-combobox'

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

// M2-DESIGN-SPEC.md §1.9 — the WAI-ARIA combobox pattern.
describe('SearchCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    pushMock.mockClear()
    geocodeSearchMock.mockClear()
  })

  it('has combobox role with a visually-hidden programmatic label', () => {
    render(<SearchCombobox channel="sale" />)
    expect(
      screen.getByRole('combobox', { name: 'Search by postcode or area' }),
    ).toBeInTheDocument()
  })

  it('debounces 250ms after the 2nd character before calling geocodeSearch', async () => {
    geocodeSearchMock.mockResolvedValue([])
    render(<SearchCombobox channel="sale" />)
    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'R' } })
    expect(geocodeSearchMock).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'RG' } })
    await tick(249)
    expect(geocodeSearchMock).not.toHaveBeenCalled()
    await tick(1)
    expect(geocodeSearchMock).toHaveBeenCalledWith('RG')
  })

  it('renders postcode and place results with their type labels', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.45,
        lng: -0.98,
        outcode: 'RG1',
      },
      {
        kind: 'place',
        name: 'Reading',
        label: 'Reading town centre',
        lat: 51.46,
        lng: -0.97,
        outcode: null,
      },
    ])
    render(<SearchCombobox channel="sale" />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Reading' },
    })
    await tick(250)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('RG1 8BT')
    expect(options[0]).toHaveTextContent('Postcode')
    expect(options[1]).toHaveTextContent('Reading town centre')
    expect(options[1]).toHaveTextContent('Place')
  })

  it('shows the friendly unrecognised-input state for zero results, not an error', async () => {
    geocodeSearchMock.mockResolvedValue([])
    render(<SearchCombobox channel="sale" />)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'zzqqxx' },
    })
    await tick(250)

    expect(
      screen.getByText('We couldn’t find anywhere matching “zzqqxx.”'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ArrowDown moves aria-activedescendant through options and wraps', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.45,
        lng: -0.98,
        outcode: 'RG1',
      },
      {
        kind: 'place',
        name: 'Reading',
        label: 'Reading',
        lat: 51.46,
        lng: -0.97,
        outcode: null,
      },
    ])
    render(<SearchCombobox channel="sale" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'Reading' } })
    await tick(250)

    const options = screen.getAllByRole('option')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
  })

  it('Enter selects the highlighted option and navigates', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.45,
        lng: -0.98,
        outcode: 'RG1',
      },
    ])
    render(<SearchCombobox channel="sale" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'RG1' } })
    await tick(250)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('/for-sale/search?'),
    )
  })

  it('Enter with no highlight but exactly one result selects that result', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.45,
        lng: -0.98,
        outcode: 'RG1',
      },
    ])
    render(<SearchCombobox channel="sale" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'RG1' } })
    await tick(250)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(pushMock).toHaveBeenCalled()
  })

  it('Escape closes the panel without clearing the typed text', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.45,
        lng: -0.98,
        outcode: 'RG1',
      },
    ])
    render(<SearchCombobox channel="sale" />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'RG1' } })
    await tick(250)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveValue('RG1')
  })

  it('clicking an option selects it and navigates', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.45,
        lng: -0.98,
        outcode: 'RG1',
      },
    ])
    render(<SearchCombobox channel="sale" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RG1' } })
    await tick(250)

    fireEvent.click(screen.getByRole('option'))
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('/for-sale/search?'),
    )
  })

  it('navigates with the /to-rent prefix when channel is rent', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.45,
        lng: -0.98,
        outcode: 'RG1',
      },
    ])
    render(<SearchCombobox channel="rent" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RG1' } })
    await tick(250)

    fireEvent.click(screen.getByRole('option'))
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('/to-rent/search?'),
    )
  })
})
