'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import type { Channel } from '@/domain/enums'
import { hrefForGeocodeSuggestion } from '@/lib/geocode-navigation'
import { geocodeSearch } from '@/lib/listings-client'
import { cn } from '@/lib/utils'
import type { GeocodeSuggestion } from '@/services/geocoding/search-geocode'

interface SearchComboboxProps {
  channel: Channel
  size?: 'lg' | 'sm'
  placeholder?: string
  className?: string
}

const DEBOUNCE_MS = 250
const MIN_QUERY_LENGTH = 2

/** Full postcodes are formatted with a space ("RG1 8BT"); an outcode-only
 * fast-path match ("RG4") has none — that's the one signal available
 * from the suggestion's own `label` to distinguish them (§1.9's
 * "Postcode" vs "Postcode area" trailing type label). */
function suggestionTypeLabel(suggestion: GeocodeSuggestion): string {
  if (suggestion.kind === 'place') return 'Place'
  return suggestion.label.includes(' ') ? 'Postcode' : 'Postcode area'
}

function suggestionPrimaryText(suggestion: GeocodeSuggestion): string {
  return suggestion.label
}

function optionId(baseId: string, index: number): string {
  return `${baseId}-option-${index}`
}

/**
 * SearchCombobox — the one geocode-suggestion combobox (§1.9), used at
 * two sizes (hero: `lg`, header: `sm`) and nowhere else. Full WAI-ARIA
 * combobox pattern: `role="combobox"` on the input, a `role="listbox"`
 * panel of `role="option"` results, `aria-activedescendant` tracking the
 * keyboard-highlighted option.
 */
export function SearchCombobox({
  channel,
  size = 'lg',
  placeholder = 'Postcode or area, e.g. Caversham or RG4',
  className,
}: SearchComboboxProps) {
  const router = useRouter()
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeSuggestion[]>([])
  const [panelState, setPanelState] = useState<'closed' | 'results' | 'empty'>(
    'closed',
  )
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [searchedQuery, setSearchedQuery] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Below the minimum length there is nothing to debounce or fetch —
    // `open` (below) already derives "closed" from the query length
    // directly, so no state write is needed here; a synchronous setState
    // in an effect body (rather than inside an async callback) is a
    // cascading-render anti-pattern the rest of this effect otherwise
    // avoids by only calling setState from the debounced fetch's own
    // .then()/.catch().
    if (query.trim().length < MIN_QUERY_LENGTH) {
      return
    }

    debounceRef.current = setTimeout(() => {
      const searchTerm = query
      geocodeSearch(searchTerm)
        .then((suggestions) => {
          setResults(suggestions)
          setSearchedQuery(searchTerm)
          setPanelState(suggestions.length > 0 ? 'results' : 'empty')
          setHighlightedIndex(-1)
        })
        .catch(() => {
          setResults([])
          setSearchedQuery(searchTerm)
          setPanelState('empty')
          setHighlightedIndex(-1)
        })
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  function selectSuggestion(suggestion: GeocodeSuggestion) {
    setPanelState('closed')
    router.push(hrefForGeocodeSuggestion(suggestion, channel))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || panelState !== 'results') return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex(
        (index) => (index - 1 + results.length) % results.length,
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target =
        highlightedIndex >= 0
          ? results[highlightedIndex]
          : results.length === 1
            ? results[0]
            : undefined
      if (target) selectSuggestion(target)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setPanelState('closed')
    } else if (event.key === 'Tab') {
      setPanelState('closed')
    }
  }

  const heightClass = size === 'lg' ? 'h-12 md:h-14' : 'h-9'
  // `panelState` can lag a query edit by up to one render (it only
  // updates once the debounced fetch resolves) — gating on the query's
  // own length too means shrinking back below the minimum closes the
  // panel immediately rather than waiting on that stale state to catch
  // up on the next successful fetch.
  const open =
    panelState !== 'closed' && query.trim().length >= MIN_QUERY_LENGTH

  return (
    <div className={cn('relative flex-1', className)}>
      <label htmlFor={baseId} className="sr-only">
        Search by postcode or area
      </label>
      <div className={cn('relative flex items-center', heightClass)}>
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute left-3 size-4"
        />
        <input
          ref={inputRef}
          id={baseId}
          role="combobox"
          type="text"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0
              ? optionId(listboxId, highlightedIndex)
              : undefined
          }
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          className="text-foreground placeholder:text-muted-foreground size-full bg-transparent pr-3 pl-9 text-base outline-none"
        />
      </div>

      {open && (
        <div className="border-border bg-card absolute top-full left-0 z-20 mt-2 w-full min-w-[280px] rounded-[var(--radius-md)] border p-2 sm:w-[360px]">
          {panelState === 'results' ? (
            <ul id={listboxId} role="listbox" aria-label="Location suggestions">
              {results.map((suggestion, index) => (
                <li
                  key={`${suggestion.kind}-${suggestion.label}-${index}`}
                  id={optionId(listboxId, index)}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 text-sm',
                    index === highlightedIndex && 'bg-clay-050',
                  )}
                >
                  <span className="text-foreground">
                    {suggestionPrimaryText(suggestion)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {suggestionTypeLabel(suggestion)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-2 text-sm">
              <p className="text-foreground">
                We couldn’t find anywhere matching “{searchedQuery}.”
              </p>
              <p className="text-muted-foreground mt-1">
                Try a full or partial postcode (RG4, RG1 8BT) or a place name
                like Caversham or Tilehurst.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
