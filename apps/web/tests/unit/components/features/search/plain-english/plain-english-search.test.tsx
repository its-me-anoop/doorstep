import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
}))

const geocodeSearchMock = vi.fn()
vi.mock('@/lib/listings-client', () => ({
  geocodeSearch: (...args: unknown[]) => geocodeSearchMock(...args),
}))

// The on-device model is exercised through the pure ranking module's
// own tests (tests/unit/lib/nl-search/semantic-hints.test.ts); here it
// is a controllable stub so these tests never touch WebAssembly or a CDN.
const loadEmbedderMock = vi.fn()
vi.mock('@/lib/nl-search/on-device-embedder', () => ({
  loadOnDeviceEmbedder: () => loadEmbedderMock(),
}))

const semanticHintsMock = vi.fn()
vi.mock('@/lib/nl-search/semantic-hints', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/nl-search/semantic-hints')
  >('@/lib/nl-search/semantic-hints')
  return {
    ...actual,
    semanticHints: (...args: unknown[]) => semanticHintsMock(...args),
  }
})

import { PlainEnglishSearch } from '@/components/features/search/plain-english/plain-english-search'

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function openPanel(name = 'Ask in plain English') {
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.getByRole('textbox', {
    name: 'Describe what you’re looking for',
  })
}

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

async function submit() {
  await act(async () => {
    fireEvent.submit(
      screen.getByRole('button', { name: /Search|Finding/ }).closest('form')!,
    )
  })
}

describe('PlainEnglishSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    loadEmbedderMock.mockResolvedValue(null)
    geocodeSearchMock.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    pushMock.mockClear()
    geocodeSearchMock.mockClear()
    loadEmbedderMock.mockClear()
    semanticHintsMock.mockClear()
  })

  it('starts collapsed behind an accessible disclosure', () => {
    render(<PlainEnglishSearch channel="sale" />)
    const toggle = screen.getByRole('button', { name: 'Ask in plain English' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('says "Refine" on a results page', () => {
    render(
      <PlainEnglishSearch
        channel="sale"
        current={{ channel: 'sale', basePath: '/for-sale', state: {} }}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Refine in plain English' }),
    ).toBeInTheDocument()
  })

  it('shows what it understood as chips while typing, before anything is applied', () => {
    render(<PlainEnglishSearch channel="sale" />)
    const input = openPanel()
    type(input, '2 bed flat in Reading under £350k with parking')

    const list = screen.getByRole('list', { name: 'What we understood' })
    expect(list).toHaveTextContent('Reading')
    expect(list).toHaveTextContent('2+ beds')
    expect(list).toHaveTextContent('Up to £350,000')
    expect(list).toHaveTextContent('Flat or apartment')
    expect(screen.getByText(/Can’t filter by/)).toHaveTextContent('parking')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('geocodes the place through /api/v1/geocode and labels the result', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.454,
        lng: -0.9788,
        outcode: 'RG1',
      },
    ])
    render(<PlainEnglishSearch channel="sale" />)
    type(openPanel(), '2 bed in RG1 8BT')

    await tick(300)
    expect(geocodeSearchMock).toHaveBeenCalledWith('RG1 8BT')
    expect(
      screen.getByRole('list', { name: 'What we understood' }),
    ).toHaveTextContent('Postcode')
  })

  it('navigates to the canonical search URL for a geocoded place plus the filters', async () => {
    geocodeSearchMock.mockResolvedValue([
      {
        kind: 'postcode',
        label: 'RG1 8BT',
        lat: 51.454,
        lng: -0.9788,
        outcode: 'RG1',
      },
    ])
    render(<PlainEnglishSearch channel="sale" />)
    type(openPanel(), '2 bed flat in RG1 8BT under £350k')
    await submit()

    expect(pushMock).toHaveBeenCalledWith(
      '/for-sale/search?maxPrice=350000&minBeds=2&type=flat&lat=51.454&lng=-0.9788&radius=3&label=RG1+8BT',
    )
  })

  it('routes a curated area to its landing page even when the geocoder is down', async () => {
    geocodeSearchMock.mockRejectedValue(new Error('offline'))
    render(<PlainEnglishSearch channel="sale" />)
    type(openPanel(), 'bungalow in Caversham')
    await submit()

    expect(pushMock).toHaveBeenCalledWith('/for-sale/caversham?type=bungalow')
  })

  it('follows a "to rent" cue over the surrounding channel', async () => {
    render(<PlainEnglishSearch channel="sale" />)
    type(openPanel(), 'furnished 1 bed to rent under £1,200 pcm')
    await submit()

    expect(pushMock).toHaveBeenCalledWith(
      '/to-rent?maxPrice=1200&minBeds=1&furnished=furnished',
    )
  })

  it('lets the visitor dismiss a chip before searching', async () => {
    render(<PlainEnglishSearch channel="sale" />)
    type(openPanel(), '2 bed flat under £350k')
    fireEvent.click(
      screen.getByRole('button', { name: 'Don’t apply Up to £350,000' }),
    )
    await submit()

    expect(pushMock).toHaveBeenCalledWith('/for-sale?minBeds=2&type=flat')
  })

  it('says so when a place cannot be found, and searches without it', async () => {
    geocodeSearchMock.mockResolvedValue([])
    render(<PlainEnglishSearch channel="sale" />)
    type(openPanel(), '2 bed in Nowhereville')
    await tick(300)
    expect(screen.getByText(/couldn’t find anywhere called/)).toHaveTextContent(
      'Nowhereville',
    )

    await submit()
    expect(pushMock).toHaveBeenCalledWith('/for-sale?minBeds=2')
  })

  it('never errors: an un-understood sentence from the hero lands on the unrestricted tier', async () => {
    render(<PlainEnglishSearch channel="rent" />)
    type(openPanel(), 'something lovely please')
    expect(
      screen.getByText(/Try a place, a number of beds or a budget/),
    ).toBeInTheDocument()
    await submit()
    expect(pushMock).toHaveBeenCalledWith('/to-rent')
  })

  it('refines a results page by merging into its current state', async () => {
    render(
      <PlainEnglishSearch
        channel="sale"
        current={{
          channel: 'sale',
          basePath: '/for-sale/caversham',
          state: { minBeds: 2, page: 3 },
        }}
      />,
    )
    type(openPanel('Refine in plain English'), 'flats under 350k')
    await submit()

    expect(pushMock).toHaveBeenCalledWith(
      '/for-sale/caversham?maxPrice=350000&minBeds=2&type=flat',
    )
  })

  it('on a results page, an empty refinement nudges instead of reloading', async () => {
    render(
      <PlainEnglishSearch
        channel="sale"
        current={{ channel: 'sale', basePath: '/for-sale', state: {} }}
      />,
    )
    type(openPanel('Refine in plain English'), 'hmm')
    await submit()
    expect(pushMock).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Try a place, a number of beds or a budget/),
    ).toBeInTheDocument()
  })

  describe('on-device suggestions', () => {
    it('does not load the model while every word is understood', async () => {
      render(<PlainEnglishSearch channel="sale" />)
      type(openPanel(), '2 bed flat in Reading')
      await tick(1000)
      expect(loadEmbedderMock).not.toHaveBeenCalled()
    })

    it('adds a marked "suggested" chip for words no rule understood, which the search then applies', async () => {
      const embed = vi.fn()
      loadEmbedderMock.mockResolvedValue(embed)
      semanticHintsMock.mockResolvedValue([
        {
          kind: 'type',
          types: ['detached'],
          phrase: 'converted barn',
          score: 0.9,
        },
      ])
      render(<PlainEnglishSearch channel="sale" />)
      type(openPanel(), '3 bed converted barn')

      await tick(400)
      expect(semanticHintsMock).toHaveBeenCalledWith(['converted barn'], embed)
      const list = screen.getByRole('list', { name: 'What we understood' })
      expect(list).toHaveTextContent('Detached house')
      expect(list).toHaveTextContent('suggested')

      await submit()
      expect(pushMock).toHaveBeenCalledWith('/for-sale?minBeds=3&type=detached')
    })

    it('degrades to the parser alone when the model is unavailable', async () => {
      loadEmbedderMock.mockResolvedValue(null)
      render(<PlainEnglishSearch channel="sale" />)
      type(openPanel(), '3 bed converted barn')

      await tick(400)
      expect(semanticHintsMock).not.toHaveBeenCalled()
      expect(screen.getByText(/Didn’t understand/)).toHaveTextContent(
        'converted barn',
      )
      await submit()
      expect(pushMock).toHaveBeenCalledWith('/for-sale?minBeds=3')
    })
  })
})
