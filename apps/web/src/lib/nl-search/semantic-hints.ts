/**
 * The on-device ML layer of plain-English search — pure logic only.
 *
 * `parseNaturalLanguageSearch` explains everything it has a rule for;
 * whatever it can't ("somewhere with no stairs for my mum", "room for
 * the car", "barn conversion") comes back as `residualFragments`. This
 * module turns those fragments into *suggestions* by nearest-prototype
 * classification in sentence-embedding space: each class below is a
 * handful of phrases a visitor might type; a fragment is assigned the
 * class whose closest prototype it is most similar to, if that
 * similarity clears a floor and beats the runner-up class by a margin.
 * Otherwise it abstains — a wrong chip is worse than no chip.
 *
 * The embedder is injected (`Embedder`), so this file has no dependency
 * on Transformers.js, WebAssembly or the browser: unit tests drive it
 * with a fake, and `on-device-embedder.ts` supplies the real one
 * (`Xenova/all-MiniLM-L6-v2`, ~23 MB quantised, loaded lazily from a
 * CDN and cached by the browser — free, no API key, nothing leaves the
 * device).
 *
 * Thresholds were calibrated against MiniLM-L6 with a hand-written
 * corpus of residual phrases: at `MIN_SCORE = 0.52`/`MIN_MARGIN = 0.05`
 * it accepts "farmhouse with acreage" → detached (0.81), "mews" →
 * terraced (0.73), "room for the car" → Parking (0.62), "elderly parent"
 * → bungalow (0.57), and abstains on "nice", "cheap", "M4", "young
 * professional", "sea view" (all ≤ 0.45). They are constants, not
 * options, because they only mean anything for this model + these
 * prototypes; changing either should mean re-calibrating.
 */

import type { PropertyType } from '@/domain/enums'

/** Sentence embeddings for a batch of texts — unit-normalised vectors of
 * one fixed dimension, so cosine similarity is a plain dot product. */
export type Embedder = (texts: string[]) => Promise<number[][]>

export type SemanticHint =
  | {
      kind: 'type'
      types: PropertyType[]
      /** The fragment that produced the hint, for "because you said…"
       * copy. */
      phrase: string
      score: number
    }
  | {
      kind: 'unsupported'
      label: string
      phrase: string
      score: number
    }

interface SemanticClass {
  id: string
  hint:
    | { kind: 'type'; types: PropertyType[] }
    | { kind: 'unsupported'; label: string }
  prototypes: string[]
}

const HOUSE_TYPES: PropertyType[] = ['detached', 'semi_detached', 'terraced']

export const SEMANTIC_CLASSES: readonly SemanticClass[] = [
  {
    id: 'type:flat',
    hint: { kind: 'type', types: ['flat'] },
    prototypes: [
      'flat',
      'apartment',
      'penthouse apartment',
      'loft apartment',
      'studio apartment',
      'garden flat',
      'first floor apartment',
      'duplex apartment',
      'city centre apartment',
    ],
  },
  {
    id: 'type:house',
    hint: { kind: 'type', types: HOUSE_TYPES },
    prototypes: [
      'house',
      'family home',
      'whole house not a flat',
      'home with a garden and stairs',
      'large family house',
    ],
  },
  {
    id: 'type:detached',
    hint: { kind: 'type', types: ['detached'] },
    prototypes: [
      'detached house',
      'cottage',
      'villa',
      'farmhouse',
      'country house',
      'barn conversion',
      'chalet',
      'house standing on its own',
    ],
  },
  {
    id: 'type:semi_detached',
    hint: { kind: 'type', types: ['semi_detached'] },
    prototypes: ['semi-detached house', 'semi'],
  },
  {
    id: 'type:terraced',
    hint: { kind: 'type', types: ['terraced'] },
    prototypes: [
      'terraced house',
      'townhouse',
      'mews house',
      'end of terrace house',
      'row house',
    ],
  },
  {
    id: 'type:bungalow',
    hint: { kind: 'type', types: ['bungalow'] },
    prototypes: [
      'bungalow',
      'single-storey home',
      'home with no stairs',
      'ground level home for an elderly parent',
      'retirement bungalow',
    ],
  },
  {
    id: 'type:maisonette',
    hint: { kind: 'type', types: ['maisonette'] },
    prototypes: ['maisonette', 'flat over two floors with its own front door'],
  },
  {
    id: 'type:land',
    hint: { kind: 'type', types: ['land'] },
    prototypes: [
      'plot of land',
      'building plot',
      'land to develop',
      'self-build plot',
    ],
  },
  {
    id: 'wish:parking',
    hint: { kind: 'unsupported', label: 'Parking' },
    prototypes: [
      'parking space',
      'somewhere to park the car',
      'garage',
      'driveway',
    ],
  },
  {
    id: 'wish:garden',
    hint: { kind: 'unsupported', label: 'Garden' },
    prototypes: [
      'garden',
      'outdoor space for the kids',
      'lawn',
      'somewhere to sit outside',
    ],
  },
  {
    id: 'wish:pets',
    hint: { kind: 'unsupported', label: 'Pets allowed' },
    prototypes: [
      'pets allowed',
      'somewhere for my dog',
      'landlord accepts cats',
      'pet friendly',
    ],
  },
  {
    id: 'wish:accessibility',
    hint: { kind: 'unsupported', label: 'Accessibility' },
    prototypes: [
      'wheelchair accessible',
      'no stairs',
      'step free access',
      'lift access',
    ],
  },
  {
    id: 'wish:amenities',
    hint: { kind: 'unsupported', label: 'Near amenities' },
    prototypes: [
      'near the train station',
      'close to good schools',
      'easy commute to London',
      'walking distance to shops',
      'near the river',
    ],
  },
  {
    id: 'wish:period',
    hint: { kind: 'unsupported', label: 'Period property' },
    prototypes: [
      'period property',
      'victorian character features',
      'original features',
      'old house with character',
    ],
  },
  {
    id: 'wish:newbuild',
    hint: { kind: 'unsupported', label: 'New build' },
    prototypes: ['new build', 'brand new development', 'newly built home'],
  },
  {
    id: 'wish:quiet',
    hint: { kind: 'unsupported', label: 'Quiet area' },
    prototypes: ['quiet area', 'peaceful street', 'cul-de-sac', 'leafy suburb'],
  },
  {
    id: 'wish:modern',
    hint: { kind: 'unsupported', label: 'Modern finish' },
    prototypes: [
      'modern finish',
      'recently renovated',
      'contemporary interior',
      'move-in ready',
    ],
  },
]

export const MIN_SCORE = 0.52
export const MIN_MARGIN = 0.05

function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i]
  return sum
}

/** Prototype embeddings are a property of the embedder (a different
 * model gives different vectors), so they're memoised per embedder
 * function rather than module-wide. */
const prototypeCache = new WeakMap<Embedder, Promise<number[][][]>>()

function prototypeEmbeddings(embed: Embedder): Promise<number[][][]> {
  let cached = prototypeCache.get(embed)
  if (!cached) {
    const flat = SEMANTIC_CLASSES.flatMap((cls) => cls.prototypes)
    cached = embed(flat).then((vectors) => {
      const perClass: number[][][] = []
      let offset = 0
      for (const cls of SEMANTIC_CLASSES) {
        perClass.push(vectors.slice(offset, offset + cls.prototypes.length))
        offset += cls.prototypes.length
      }
      return perClass
    })
    // A failed load shouldn't poison every later call.
    cached.catch(() => prototypeCache.delete(embed))
    prototypeCache.set(embed, cached)
  }
  return cached
}

/**
 * Classifies each unexplained fragment independently and returns the
 * accepted hints, de-duplicated by class (two fragments both pointing at
 * "Garden" yield one hint) and in fragment order. Fragments already
 * covered by a rule-based finding should be filtered out by the caller
 * — this function has no view of the parse.
 */
export async function semanticHints(
  fragments: readonly string[],
  embed: Embedder,
): Promise<SemanticHint[]> {
  const candidates = fragments
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length >= 3)
  if (candidates.length === 0) return []

  const [prototypes, vectors] = await Promise.all([
    prototypeEmbeddings(embed),
    embed(candidates),
  ])

  const hints: SemanticHint[] = []
  const seen = new Set<string>()
  candidates.forEach((phrase, index) => {
    const vector = vectors[index]
    const scored = SEMANTIC_CLASSES.map((cls, classIndex) => ({
      cls,
      score: Math.max(
        ...prototypes[classIndex].map((prototype) => dot(vector, prototype)),
      ),
    })).sort((a, b) => b.score - a.score)

    const [best, runnerUp] = scored
    if (!best || best.score < MIN_SCORE) return
    if (runnerUp && best.score - runnerUp.score < MIN_MARGIN) return
    if (seen.has(best.cls.id)) return
    seen.add(best.cls.id)

    const score = Number(best.score.toFixed(3))
    hints.push(
      best.cls.hint.kind === 'type'
        ? { kind: 'type', types: best.cls.hint.types, phrase, score }
        : { kind: 'unsupported', label: best.cls.hint.label, phrase, score },
    )
  })
  return hints
}
