'use client'

import { Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  type FormEvent,
  startTransition,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { Channel } from '@/domain/enums'
import {
  buildNlSearchReadout,
  type NlChip,
  type NlChipFacet,
} from '@/components/features/search/plain-english/readout'
import { useSemanticHints } from '@/components/features/search/plain-english/use-semantic-hints'
import { Button } from '@/components/ui/button'
import { channelPrefix } from '@/lib/geocode-navigation'
import { geocodeSearch } from '@/lib/listings-client'
import {
  hrefForNaturalLanguageSearch,
  type CurrentSearchContext,
} from '@/lib/nl-search/navigation'
import { parseNaturalLanguageSearch } from '@/lib/nl-search/parse'
import {
  mergeTypeaheadSuggestions,
  type TypeaheadSuggestion,
} from '@/lib/typeahead-suggestions'
import { cn } from '@/lib/utils'

interface PlainEnglishSearchProps {
  /** The channel already selected around this box (the hero's toggle,
   * or the results page's own) — what the search runs on unless the
   * sentence says otherwise. */
  channel: Channel
  /** Present on a results page: the search being refined. Absent on the
   * hero, where a sentence starts a search from nothing. */
  current?: CurrentSearchContext
  className?: string
}

/** Same as SearchCombobox's own debounce — one geocode round trip per
 * pause in typing, not per keystroke. */
const GEOCODE_DEBOUNCE_MS = 300

const PLACEHOLDER: Record<Channel, string> = {
  sale: 'e.g. 2 bed flat in Caversham under £350k with parking',
  rent: 'e.g. furnished 1 bed near Reading station under £1,300 pcm',
}

type PlaceResolution =
  | { status: 'resolving' }
  | { status: 'resolved'; suggestion: TypeaheadSuggestion }
  | { status: 'unresolved' }

function suggestionKindLabel(suggestion: TypeaheadSuggestion): string {
  if (suggestion.kind === 'area') return 'Area'
  if (suggestion.kind === 'place') return 'Place'
  return suggestion.label.includes(' ') ? 'Postcode' : 'Postcode area'
}

function chipKey(chip: NlChip): string {
  return `${chip.facet}:${chip.label}`
}

/**
 * PlainEnglishSearch — "Ask in plain English." One sentence in, the
 * existing search URL out. The visitor types what they're after; the
 * rule-based parser (lib/nl-search/parse.ts) shows what it understood as
 * dismissible chips *before* anything is applied; the on-device model
 * (use-semantic-hints.ts) may add a marked "suggested" chip for words no
 * rule knew; the place is geocoded through the same `/api/v1/geocode`
 * route the combobox uses; and Search navigates to the same canonical
 * URL the filter bar would have produced (lib/nl-search/navigation.ts).
 *
 * Nothing the visitor types is sent to any AI service — parsing is
 * synchronous TypeScript and the model runs in their browser. The only
 * network calls are the geocode lookup the ordinary search box already
 * makes and, once, the model download.
 *
 * Collapsed behind a disclosure by default so the primary search
 * instrument (hero combobox / results filter bar) stays the primary
 * one; this is the second way in, for people who'd rather say it than
 * click it.
 */
export function PlainEnglishSearch({
  channel,
  current,
  className,
}: PlainEnglishSearchProps) {
  const router = useRouter()
  const baseId = useId()
  const inputId = `${baseId}-input`
  const panelId = `${baseId}-panel`

  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [placeResolution, setPlaceResolution] = useState<
    (PlaceResolution & { place: string }) | null
  >(null)
  const [submitting, setSubmitting] = useState(false)
  const [nudge, setNudge] = useState(false)

  const parse = useMemo(() => parseNaturalLanguageSearch(text), [text])
  const semantic = useSemanticHints(open ? parse.residualFragments : [])

  // Dismissals are keyed on facet + label, so editing the sentence so
  // that a facet's value changes brings its chip back (the visitor
  // dismissed "Up to £350,000", not "any price ever").
  const undismissed = buildNlSearchReadout({
    parse,
    fallbackChannel: channel,
    hints: semantic.hints,
  })
  const dismissedFacets = new Set<NlChipFacet>(
    undismissed.chips
      .filter((chip) => dismissed.has(chipKey(chip)))
      .map((chip) => chip.facet),
  )
  const readout = buildNlSearchReadout({
    parse,
    fallbackChannel: channel,
    hints: semantic.hints,
    dismissed: dismissedFacets,
  })
  const placeWanted =
    parse.place !== undefined && !dismissedFacets.has('place')
      ? parse.place
      : undefined

  // One geocode per distinct place string, shared between the live
  // read-out and Search itself (so a submit mid-lookup awaits the same
  // request rather than firing a second).
  const lookups = useRef(new Map<string, Promise<TypeaheadSuggestion | null>>())
  function resolvePlace(place: string): Promise<TypeaheadSuggestion | null> {
    const key = place.toLowerCase()
    let pending = lookups.current.get(key)
    if (!pending) {
      pending = geocodeSearch(place)
        .then((results) => mergeTypeaheadSuggestions(place, results)[0] ?? null)
        .catch(() => {
          // A failed lookup still lets the curated areas match offline.
          return mergeTypeaheadSuggestions(place, [])[0] ?? null
        })
      lookups.current.set(key, pending)
    }
    return pending
  }

  useEffect(() => {
    if (!open || !placeWanted) return
    let cancelled = false
    const timer = setTimeout(() => {
      setPlaceResolution({ place: placeWanted, status: 'resolving' })
      resolvePlace(placeWanted).then((suggestion) => {
        if (cancelled) return
        setPlaceResolution(
          suggestion
            ? { place: placeWanted, status: 'resolved', suggestion }
            : { place: placeWanted, status: 'unresolved' },
        )
      })
    }, GEOCODE_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, placeWanted])

  const resolution =
    placeWanted && placeResolution?.place === placeWanted
      ? placeResolution
      : undefined

  function handleTextChange(value: string) {
    setText(value)
    setNudge(false)
  }

  function dismiss(chip: NlChip) {
    setDismissed((current) => new Set([...current, chipKey(chip)]))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    let suggestion: TypeaheadSuggestion | null = null
    if (placeWanted) {
      setSubmitting(true)
      try {
        suggestion = await resolvePlace(placeWanted)
      } finally {
        setSubmitting(false)
      }
    }

    const hasSomething =
      suggestion !== null ||
      readout.chips.some((chip) => !dismissedFacets.has(chip.facet))
    if (!hasSomething) {
      if (current) {
        // Refining a results page with nothing to apply: say so rather
        // than reloading the same URL.
        setNudge(true)
        return
      }
      // The hero's own rule (hero-search-box.tsx): never an error page —
      // an empty or un-understood sentence lands on the unrestricted tier.
      startTransition(() => router.push(channelPrefix(readout.channel)))
      return
    }

    const href = hrefForNaturalLanguageSearch({
      filters: readout.filters,
      channel: readout.channel,
      suggestion,
      current,
    })
    startTransition(() => router.push(href))
  }

  const showReadout = open && text.trim().length > 0
  const showResidual =
    parse.residual.length > 0 &&
    semantic.status !== 'thinking' &&
    // A residual the model turned into a suggestion isn't "not
    // understood" any more.
    !semantic.hints.some((hint) => parse.residual.includes(hint.phrase))

  return (
    <div className={cn('w-full', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="text-foreground hover:text-primary inline-flex min-h-11 items-center gap-2 text-sm font-medium"
      >
        <Sparkles aria-hidden="true" className="text-primary size-4" />
        {current ? 'Refine in plain English' : 'Ask in plain English'}
        <span className="text-muted-foreground font-normal">
          {open ? '(hide)' : ''}
        </span>
      </button>

      {open && (
        <form
          id={panelId}
          onSubmit={handleSubmit}
          className="border-border bg-card mt-2 rounded-[var(--radius-md)] border p-3 sm:p-4"
        >
          <label htmlFor={inputId} className="sr-only">
            Describe what you&rsquo;re looking for
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              id={inputId}
              type="text"
              autoComplete="off"
              autoFocus
              value={text}
              placeholder={PLACEHOLDER[channel]}
              onChange={(event) => handleTextChange(event.target.value)}
              aria-describedby={`${baseId}-privacy`}
              className="border-input text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border bg-transparent px-3 text-base outline-none focus-visible:ring-3"
            />
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-[var(--radius-md)] px-5"
            >
              {submitting ? 'Finding…' : 'Search'}
            </Button>
          </div>

          {showReadout && (
            <div aria-live="polite" className="mt-3 flex flex-col gap-2">
              {readout.chips.length > 0 && (
                <ul
                  aria-label="What we understood"
                  className="flex flex-wrap items-center gap-2"
                >
                  {readout.chips.map((chip) => {
                    const isDismissed = dismissedFacets.has(chip.facet)
                    return (
                      <li
                        key={chipKey(chip)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-sm font-medium',
                          isDismissed
                            ? 'text-muted-foreground bg-muted line-through'
                            : chip.source === 'suggested'
                              ? 'border-primary/40 text-foreground border border-dashed bg-transparent'
                              : 'bg-clay-050 text-clay-600',
                        )}
                        title={
                          chip.source === 'suggested' && chip.because
                            ? `Suggested because you said “${chip.because}”`
                            : undefined
                        }
                      >
                        {chip.source === 'suggested' && (
                          <Sparkles
                            aria-hidden="true"
                            className="text-primary size-3.5"
                          />
                        )}
                        <span>
                          {chip.label}
                          {chip.facet === 'place' && resolution && (
                            <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                              {resolution.status === 'resolving'
                                ? 'looking up…'
                                : resolution.status === 'resolved'
                                  ? suggestionKindLabel(resolution.suggestion)
                                  : 'not found'}
                            </span>
                          )}
                          {chip.source === 'suggested' && (
                            <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                              suggested
                            </span>
                          )}
                        </span>
                        {!isDismissed && (
                          <button
                            type="button"
                            aria-label={`Don’t apply ${chip.label}`}
                            onClick={() => dismiss(chip)}
                            className="-m-2.5 flex size-11 items-center justify-center hover:opacity-70"
                          >
                            <X aria-hidden="true" className="size-3.5" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {resolution?.status === 'unresolved' && (
                <p className="text-muted-foreground text-sm">
                  We couldn&rsquo;t find anywhere called &ldquo;
                  {resolution.place}&rdquo; — we&rsquo;ll search{' '}
                  {current ? 'where you already are' : 'everywhere'} instead.
                </p>
              )}

              {readout.unsupported.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  Can&rsquo;t filter by{' '}
                  {readout.unsupported.map((entry, index) => (
                    <span key={entry.label}>
                      {index > 0 &&
                        (index === readout.unsupported.length - 1
                          ? ' or '
                          : ', ')}
                      <span className="text-foreground">
                        {entry.label.toLowerCase()}
                      </span>
                    </span>
                  ))}{' '}
                  yet — worth checking each listing for it.
                </p>
              )}

              {showResidual && (
                <p className="text-muted-foreground text-sm">
                  Didn&rsquo;t understand &ldquo;{parse.residual}&rdquo;.
                </p>
              )}

              {semantic.status === 'thinking' && (
                <p className="text-muted-foreground text-sm">
                  Working out the rest on your device…
                </p>
              )}

              {(nudge || (!parse.understood && text.trim().length >= 8)) && (
                <p className="text-foreground text-sm">
                  Try a place, a number of beds or a budget — for example
                  &ldquo;{PLACEHOLDER[readout.channel].replace('e.g. ', '')}
                  &rdquo;.
                </p>
              )}
            </div>
          )}

          <p
            id={`${baseId}-privacy`}
            className="text-muted-foreground mt-3 text-xs"
          >
            Interpreted in your browser — nothing you type here is sent to an AI
            service.
          </p>
        </form>
      )}
    </div>
  )
}
