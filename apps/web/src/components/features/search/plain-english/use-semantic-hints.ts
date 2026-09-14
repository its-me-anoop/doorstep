'use client'

import { useEffect, useRef, useState } from 'react'

import { loadOnDeviceEmbedder } from '@/lib/nl-search/on-device-embedder'
import {
  semanticHints,
  type SemanticHint,
} from '@/lib/nl-search/semantic-hints'

export type SemanticHintsStatus =
  /** Nothing to classify (every word was understood by a rule). */
  | 'idle'
  /** Model loading or a classification in flight. */
  | 'thinking'
  | 'ready'
  /** The model couldn't be loaded here — the parser alone is the feature. */
  | 'unavailable'

export interface SemanticHintsState {
  hints: SemanticHint[]
  status: SemanticHintsStatus
}

/** Typing pauses this long before the fragments are sent to the model —
 * long enough that a half-typed word isn't classified, short enough
 * that the suggestion lands while the visitor is still reading the
 * chips. Independent of the geocode debounce: an on-device inference is
 * cheaper than a network round trip but not free. */
const DEBOUNCE_MS = 400

/**
 * Runs the on-device semantic layer over the parser's unexplained
 * fragments. The model is only ever loaded once a visitor has typed
 * something the rules couldn't explain — a hero visitor who never opens
 * the plain-English box, or whose sentence the parser fully understood,
 * never downloads it. Every failure mode collapses to `unavailable`
 * with no hints; nothing here can block or break the rule-based path.
 */
export function useSemanticHints(
  fragments: readonly string[],
): SemanticHintsState {
  const [state, setState] = useState<SemanticHintsState>({
    hints: [],
    status: 'idle',
  })
  // Keyed on content, not array identity — the parser returns a fresh
  // array every render.
  const key = fragments.join('\u0000')
  // Once the model has failed to load in this session, stop asking —
  // every keystroke retrying a dead CDN would be worse than no hints.
  const unavailable = useRef(false)

  useEffect(() => {
    if (key.length === 0 || unavailable.current) return

    let cancelled = false
    const timer = setTimeout(() => {
      // Old hints were about the old words — never show them against
      // the new ones while the model catches up.
      setState((current) =>
        current.status === 'unavailable'
          ? current
          : { hints: [], status: 'thinking' },
      )
      loadOnDeviceEmbedder()
        .then((embed) => {
          if (cancelled) return null
          if (!embed) {
            unavailable.current = true
            setState({ hints: [], status: 'unavailable' })
            return null
          }
          return semanticHints(key.split('\u0000'), embed)
        })
        .then((hints) => {
          if (cancelled || hints === null) return
          setState({ hints, status: 'ready' })
        })
        .catch(() => {
          if (cancelled) return
          unavailable.current = true
          setState({ hints: [], status: 'unavailable' })
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key])

  // With nothing left to classify there are no hints to show, whatever
  // the last run produced — derived here rather than written back into
  // state from the effect. `unavailable` is sticky for the session.
  if (key.length === 0) {
    return {
      hints: [],
      status: state.status === 'unavailable' ? 'unavailable' : 'idle',
    }
  }
  return state
}
