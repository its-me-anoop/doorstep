import { describe, expect, it, vi } from 'vitest'

import {
  MIN_MARGIN,
  MIN_SCORE,
  SEMANTIC_CLASSES,
  semanticHints,
  type Embedder,
} from '@/lib/nl-search/semantic-hints'

// The on-device layer's pure ranking logic, driven by a fake embedder so
// the tests need no model, no WebAssembly and no network. The real
// thresholds were calibrated separately against MiniLM-L6 (see the
// module's own doc comment); here we only check the *decision rule*
// around them.

/** Builds a deterministic embedder over a fixed vocabulary: every text
 * gets a one-hot vector for its own exact string, except that entries in
 * `similarities` map a query to a weighted mix of prototype directions,
 * so the cosine (dot, since all vectors are unit length) against each
 * prototype is exactly the configured number. */
function fakeEmbedder(
  similarities: Record<string, Record<string, number>>,
): Embedder {
  const prototypes = SEMANTIC_CLASSES.flatMap((cls) => cls.prototypes)
  const dimension = prototypes.length + 1
  const axis = (prototype: string) => {
    const vector = new Array<number>(dimension).fill(0)
    vector[prototypes.indexOf(prototype)] = 1
    return vector
  }
  return vi.fn(async (texts: string[]) =>
    texts.map((text) => {
      if (prototypes.includes(text)) return axis(text)
      const spec = similarities[text]
      const vector = new Array<number>(dimension).fill(0)
      if (!spec) {
        // An unrelated direction — similar to nothing.
        vector[dimension - 1] = 1
        return vector
      }
      let remaining = 1
      for (const [prototype, similarity] of Object.entries(spec)) {
        vector[prototypes.indexOf(prototype)] = similarity
        remaining -= similarity ** 2
      }
      // Pad to unit length on the spare axis so the dot products stay
      // exactly the configured similarities.
      vector[dimension - 1] = Math.sqrt(Math.max(0, remaining))
      return vector
    }),
  )
}

describe('semanticHints', () => {
  it('suggests a property type when a fragment clearly matches one class', async () => {
    const embed = fakeEmbedder({
      'converted barn': { 'barn conversion': 0.9, townhouse: 0.3 },
    })
    const hints = await semanticHints(['converted barn'], embed)
    expect(hints).toEqual([
      {
        kind: 'type',
        types: ['detached'],
        phrase: 'converted barn',
        score: 0.9,
      },
    ])
  })

  it('reports an unsupported wish when the fragment matches one', async () => {
    const embed = fakeEmbedder({
      'room for the car': { 'somewhere to park the car': 0.62, garden: 0.4 },
    })
    const hints = await semanticHints(['room for the car'], embed)
    expect(hints).toEqual([
      {
        kind: 'unsupported',
        label: 'Parking',
        phrase: 'room for the car',
        score: 0.62,
      },
    ])
  })

  it('abstains below the score floor', async () => {
    const embed = fakeEmbedder({
      nice: { 'new build': MIN_SCORE - 0.01 },
    })
    expect(await semanticHints(['nice'], embed)).toEqual([])
  })

  it('abstains when the runner-up class is too close', async () => {
    const embed = fakeEmbedder({
      'no stairs for my mum': {
        'home with no stairs': 0.65,
        'no stairs': 0.65 - MIN_MARGIN + 0.01,
      },
    })
    expect(await semanticHints(['no stairs for my mum'], embed)).toEqual([])
  })

  it('accepts when the runner-up is exactly the margin away', async () => {
    const embed = fakeEmbedder({
      'no stairs for my mum': {
        'home with no stairs': 0.65,
        'no stairs': 0.65 - MIN_MARGIN,
      },
    })
    const hints = await semanticHints(['no stairs for my mum'], embed)
    expect(hints.map((hint) => hint.kind)).toEqual(['type'])
  })

  it('takes the best prototype within a class, not the average', async () => {
    const embed = fakeEmbedder({
      chalet: { chalet: 0.99, cottage: 0.1 },
    })
    const hints = await semanticHints(['chalet'], embed)
    expect(hints[0]).toMatchObject({ kind: 'type', types: ['detached'] })
  })

  it('classifies fragments independently and de-duplicates by class', async () => {
    const embed = fakeEmbedder({
      'quiet street': { 'peaceful street': 0.8 },
      leafy: { 'leafy suburb': 0.7 },
      'log burner': {},
    })
    const hints = await semanticHints(
      ['quiet street', 'log burner', 'leafy'],
      embed,
    )
    expect(hints).toEqual([
      {
        kind: 'unsupported',
        label: 'Quiet area',
        phrase: 'quiet street',
        score: 0.8,
      },
    ])
  })

  it('ignores fragments too short to mean anything and embeds nothing for none', async () => {
    const embed = fakeEmbedder({})
    expect(await semanticHints(['', 'a', '  '], embed)).toEqual([])
    expect(embed).not.toHaveBeenCalled()
  })

  it('embeds the prototypes once per embedder and reuses them', async () => {
    const embed = fakeEmbedder({ chalet: { chalet: 0.99 } })
    await semanticHints(['chalet'], embed)
    await semanticHints(['chalet'], embed)
    // First call: prototypes + fragments (two batches). Second: fragments only.
    expect(embed).toHaveBeenCalledTimes(3)
  })

  it('propagates an embedder failure rather than inventing hints', async () => {
    const embed: Embedder = async () => {
      throw new Error('model failed to load')
    }
    await expect(semanticHints(['chalet'], embed)).rejects.toThrow(
      'model failed to load',
    )
  })
})
