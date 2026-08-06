import { randomUUID } from 'node:crypto'

import { Meilisearch } from 'meilisearch'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  FILTERABLE_ATTRIBUTES,
  MeilisearchSearchIndex,
  resolveMeilisearchIndexName,
  SEARCHABLE_ATTRIBUTES,
  SORTABLE_ATTRIBUTES,
} from '@/adapters/meilisearch'
import type { ListingSearchDocument } from '@/ports/search-index'

// Exercises MeilisearchSearchIndex against a real Meilisearch daemon (PRD
// §8.6) — same skip-when-absent shape as this directory's Postgres suites
// (TEST_DATABASE_URL), gated on TEST_MEILISEARCH_HOST/TEST_MEILISEARCH_API_KEY
// instead. Run locally against the dev daemon with:
//   TEST_MEILISEARCH_HOST=http://127.0.0.1:7700 \
//   TEST_MEILISEARCH_API_KEY=local-dev-master-key \
//   pnpm test:integration
// CI wires the same two vars to its own scaffold Meilisearch service
// container (.github/workflows/ci.yml).
//
// Every test run gets its own index, named from a random per-run prefix
// (MEILISEARCH_INDEX_PREFIX override) rather than the real "doorstep"
// one — so a run can never collide with another concurrent run, or with
// a real dev/CI index, and afterAll deletes it outright.
const TEST_MEILISEARCH_HOST = process.env.TEST_MEILISEARCH_HOST
const TEST_MEILISEARCH_API_KEY = process.env.TEST_MEILISEARCH_API_KEY

// Reading town centre. All twelve fixtures below sit within ~1.2km of
// this point; Newbury (real town, ~26km west) stands in for "somewhere a
// radius/bbox search should exclude".
const READING = { lat: 51.4543, lng: -0.9781 }
const NEWBURY = { lat: 51.4014, lng: -1.3145 }

const BASE_PUBLISHED_AT = Math.floor(
  new Date('2026-01-01T00:00:00Z').getTime() / 1000,
)

function doc(
  overrides: Partial<ListingSearchDocument> &
    Pick<ListingSearchDocument, 'id' | 'channel' | 'propertyType'>,
): ListingSearchDocument {
  const index = FIXTURE_ORDER.indexOf(overrides.id)
  return {
    title: `Test listing ${overrides.id}`,
    displayAddress: `${overrides.id}, Reading`,
    town: 'Reading',
    outcode: 'RG1',
    bedrooms: 2,
    bathrooms: 1,
    price: 250000,
    priceQualifier: 'guide_price',
    tenure: null,
    furnished: null,
    availableFrom: null,
    newHome: false,
    features: [],
    coverImageUrl: null,
    imageCount: 0,
    agency: null,
    publishedAt: BASE_PUBLISHED_AT + Math.max(index, 0) * 3600,
    _geo: READING,
    ...overrides,
  }
}

// Insertion order also fixes each fixture's publishedAt (see doc() above)
// so the "sort: newest" test has a deterministic, distinct ordering to
// assert against.
const FIXTURE_ORDER = [
  'rdg-sale-flat-1',
  'rdg-sale-flat-2',
  'rdg-sale-terraced-1',
  'rdg-sale-detached-1',
  'rdg-sale-semi-1',
  'rdg-sale-bungalow-1',
  'rdg-sale-flat-luxury',
  'rdg-rent-flat-1',
  'rdg-rent-flat-2',
  'rdg-rent-terraced-1',
  'newbury-sale-flat-1',
  'newbury-rent-flat-1',
]

const FIXTURES: ListingSearchDocument[] = [
  doc({
    id: 'rdg-sale-flat-1',
    channel: 'sale',
    propertyType: 'flat',
    price: 180000,
    bedrooms: 1,
    bathrooms: 1,
    tenure: 'leasehold',
    _geo: { lat: 51.455, lng: -0.979 },
  }),
  doc({
    id: 'rdg-sale-flat-2',
    channel: 'sale',
    propertyType: 'flat',
    price: 220000,
    bedrooms: 2,
    bathrooms: 1,
    tenure: 'leasehold',
    _geo: { lat: 51.456, lng: -0.976 },
  }),
  doc({
    id: 'rdg-sale-terraced-1',
    channel: 'sale',
    propertyType: 'terraced',
    price: 320000,
    bedrooms: 3,
    bathrooms: 1,
    tenure: 'freehold',
    _geo: { lat: 51.45, lng: -0.98 },
  }),
  doc({
    id: 'rdg-sale-detached-1',
    channel: 'sale',
    propertyType: 'detached',
    price: 550000,
    bedrooms: 4,
    bathrooms: 2,
    tenure: 'freehold',
    _geo: { lat: 51.448, lng: -0.982 },
  }),
  doc({
    id: 'rdg-sale-semi-1',
    channel: 'sale',
    propertyType: 'semi_detached',
    price: 400000,
    bedrooms: 3,
    bathrooms: 2,
    tenure: 'freehold',
    _geo: { lat: 51.46, lng: -0.97 },
  }),
  doc({
    id: 'rdg-sale-bungalow-1',
    channel: 'sale',
    propertyType: 'bungalow',
    price: 275000,
    bedrooms: 2,
    bathrooms: 1,
    tenure: 'freehold',
    _geo: { lat: 51.457, lng: -0.975 },
  }),
  doc({
    id: 'rdg-sale-flat-luxury',
    channel: 'sale',
    propertyType: 'flat',
    price: 999000,
    bedrooms: 5,
    bathrooms: 3,
    tenure: 'share_of_freehold',
    newHome: true,
    _geo: { lat: 51.453, lng: -0.979 },
  }),
  doc({
    id: 'rdg-rent-flat-1',
    channel: 'rent',
    propertyType: 'flat',
    price: 1200,
    priceQualifier: 'fixed',
    bedrooms: 1,
    bathrooms: 1,
    furnished: 'furnished',
    availableFrom: '2026-09-01',
    outcode: 'RG30',
    _geo: { lat: 51.454, lng: -0.9785 },
  }),
  doc({
    id: 'rdg-rent-flat-2',
    channel: 'rent',
    propertyType: 'flat',
    price: 1500,
    priceQualifier: 'fixed',
    bedrooms: 2,
    bathrooms: 1,
    furnished: 'unfurnished',
    availableFrom: '2026-10-15',
    outcode: 'RG30',
    _geo: { lat: 51.4555, lng: -0.9775 },
  }),
  doc({
    id: 'rdg-rent-terraced-1',
    channel: 'rent',
    propertyType: 'terraced',
    price: 1800,
    priceQualifier: 'fixed',
    bedrooms: 3,
    bathrooms: 1,
    furnished: 'part_furnished',
    availableFrom: '2026-08-20',
    outcode: 'RG30',
    _geo: { lat: 51.452, lng: -0.981 },
  }),
  doc({
    id: 'newbury-sale-flat-1',
    channel: 'sale',
    propertyType: 'flat',
    price: 190000,
    bedrooms: 1,
    bathrooms: 1,
    tenure: 'leasehold',
    town: 'Newbury',
    outcode: 'RG14',
    _geo: NEWBURY,
  }),
  doc({
    id: 'newbury-rent-flat-1',
    channel: 'rent',
    propertyType: 'flat',
    price: 1000,
    priceQualifier: 'fixed',
    bedrooms: 1,
    bathrooms: 1,
    furnished: 'furnished',
    availableFrom: '2026-07-01',
    town: 'Newbury',
    outcode: 'RG14',
    _geo: NEWBURY,
  }),
]

const SALE_IDS = FIXTURES.filter((f) => f.channel === 'sale').map((f) => f.id)
const RENT_IDS = FIXTURES.filter((f) => f.channel === 'rent').map((f) => f.id)

describe.skipIf(!TEST_MEILISEARCH_HOST)(
  'MeilisearchSearchIndex (live daemon)',
  () => {
    const runPrefix = `doorstep-test-${Date.now()}-${randomUUID().slice(0, 8)}`
    const env = {
      ...process.env,
      MEILISEARCH_HOST: TEST_MEILISEARCH_HOST,
      MEILISEARCH_API_KEY: TEST_MEILISEARCH_API_KEY,
      MEILISEARCH_INDEX_PREFIX: runPrefix,
    }
    const indexName = resolveMeilisearchIndexName(env)
    const searchIndex = new MeilisearchSearchIndex(env)
    // A raw client, used only for the assertions/cleanup the SearchIndex
    // port has no reason to expose (reading back applied settings,
    // deleting the whole disposable per-run index). Built inside
    // beforeAll, not at describe-body scope: unlike
    // MeilisearchSearchIndex (deliberately lazy, see that class's doc
    // comment), the raw `Meilisearch` client validates its `host` eagerly
    // in its constructor — describe.skipIf still *evaluates* this
    // describe block's body to collect its tests even when every test in
    // it will be skipped, so constructing it here would throw on
    // `undefined` the moment this file loads without
    // TEST_MEILISEARCH_HOST set (e.g. every other suite's plain `pnpm
    // test` run).
    let rawClient: Meilisearch

    beforeAll(async () => {
      rawClient = new Meilisearch({
        host: TEST_MEILISEARCH_HOST as string,
        apiKey: TEST_MEILISEARCH_API_KEY,
      })
      await searchIndex.ensureSettings()
      await searchIndex.upsert(FIXTURES)
    }, 30_000)

    afterAll(async () => {
      await rawClient.deleteIndex(indexName).waitTask()
    })

    describe('ensureSettings', () => {
      it('applies exactly the PRD §8.6 filterable/sortable/searchable attributes', async () => {
        const settings = await rawClient.index(indexName).getSettings()

        expect([...(settings.filterableAttributes ?? [])].sort()).toEqual(
          [...FILTERABLE_ATTRIBUTES].sort(),
        )
        expect([...(settings.sortableAttributes ?? [])].sort()).toEqual(
          [...SORTABLE_ATTRIBUTES].sort(),
        )
        expect(settings.searchableAttributes).toEqual([
          ...SEARCHABLE_ATTRIBUTES,
        ])
      })

      it('is idempotent — a second call leaves the same settings in place', async () => {
        await searchIndex.ensureSettings()

        const settings = await rawClient.index(indexName).getSettings()
        expect([...(settings.filterableAttributes ?? [])].sort()).toEqual(
          [...FILTERABLE_ATTRIBUTES].sort(),
        )
        expect([...(settings.sortableAttributes ?? [])].sort()).toEqual(
          [...SORTABLE_ATTRIBUTES].sort(),
        )
        expect(settings.searchableAttributes).toEqual([
          ...SEARCHABLE_ATTRIBUTES,
        ])
      })
    })

    describe('countDocuments', () => {
      it('reports every upserted document', async () => {
        expect(await searchIndex.countDocuments()).toBe(FIXTURES.length)
      })
    })

    describe('healthy', () => {
      it('is true against a reachable daemon', async () => {
        expect(await searchIndex.healthy()).toBe(true)
      })
    })

    describe('search — geo', () => {
      it('_geoRadius excludes listings outside the radius', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          geo: {
            kind: 'radius',
            lat: READING.lat,
            lng: READING.lng,
            radiusMetres: 5000,
          },
          hitsPerPage: 50,
          page: 1,
        })

        const ids = result.hits.map((hit) => hit.id).sort()
        // Every Reading sale fixture, none of Newbury's.
        expect(ids).toEqual(
          [...SALE_IDS].filter((id) => id !== 'newbury-sale-flat-1').sort(),
        )
      })

      it('_geoBoundingBox includes exactly the listings inside the box', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          geo: {
            kind: 'bbox',
            topRight: { lat: 51.47, lng: -0.95 },
            bottomLeft: { lat: 51.44, lng: -1.0 },
          },
          hitsPerPage: 50,
          page: 1,
        })

        const ids = result.hits.map((hit) => hit.id).sort()
        expect(ids).toEqual(
          [...SALE_IDS].filter((id) => id !== 'newbury-sale-flat-1').sort(),
        )
      })
    })

    describe('search — filters', () => {
      it('price bounds are inclusive on both ends', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { priceMin: 220000, priceMax: 320000 },
          hitsPerPage: 50,
          page: 1,
        })

        // 220000 (flat-2) and 320000 (terraced-1) both included at the
        // exact boundary; 275000 (bungalow-1) falls inside too.
        expect(result.hits.map((h) => h.id).sort()).toEqual(
          [
            'rdg-sale-bungalow-1',
            'rdg-sale-flat-2',
            'rdg-sale-terraced-1',
          ].sort(),
        )
      })

      it('bedroomsMin/bedroomsMax narrows to an exact range', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { bedroomsMin: 3, bedroomsMax: 3 },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id).sort()).toEqual(
          ['rdg-sale-semi-1', 'rdg-sale-terraced-1'].sort(),
        )
      })

      it('bathroomsMin excludes anything below the threshold', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { bathroomsMin: 2 },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id).sort()).toEqual(
          [
            'rdg-sale-detached-1',
            'rdg-sale-flat-luxury',
            'rdg-sale-semi-1',
          ].sort(),
        )
      })

      it('propertyTypes is a multi-select OR within the overall AND', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { propertyTypes: ['bungalow', 'terraced'] },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id).sort()).toEqual(
          ['rdg-sale-bungalow-1', 'rdg-sale-terraced-1'].sort(),
        )
      })

      it('tenure matches exactly', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { tenure: 'share_of_freehold' },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id)).toEqual(['rdg-sale-flat-luxury'])
      })

      it('furnished matches exactly', async () => {
        const result = await searchIndex.search({
          channel: 'rent',
          filters: { furnished: 'furnished' },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id).sort()).toEqual(
          ['newbury-rent-flat-1', 'rdg-rent-flat-1'].sort(),
        )
      })

      it('availableFromBefore is a strict less-than date comparison', async () => {
        const result = await searchIndex.search({
          channel: 'rent',
          filters: { availableFromBefore: '2026-09-01' },
          hitsPerPage: 50,
          page: 1,
        })

        // rdg-rent-flat-1's availableFrom is exactly 2026-09-01 — the
        // boundary itself must NOT match a strict "<".
        expect(result.hits.map((h) => h.id).sort()).toEqual(
          ['newbury-rent-flat-1', 'rdg-rent-terraced-1'].sort(),
        )
      })

      it('newHome matches exactly', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { newHome: true },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id)).toEqual(['rdg-sale-flat-luxury'])
      })

      it('town narrows to an exact match', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { town: 'Newbury' },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id)).toEqual(['newbury-sale-flat-1'])
      })

      it('outcode narrows to an exact match', async () => {
        const result = await searchIndex.search({
          channel: 'rent',
          filters: { outcode: 'RG30' },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id).sort()).toEqual(
          ['rdg-rent-flat-1', 'rdg-rent-flat-2', 'rdg-rent-terraced-1'].sort(),
        )
      })

      it('every filter still ANDs with every other filter and with channel', async () => {
        // Three flats exist in the sale channel (180000, 190000, 999000,
        // plus 220000) — priceMax narrows the flat OR-group down to
        // exactly the one below the 185000 threshold.
        const result = await searchIndex.search({
          channel: 'sale',
          filters: { propertyTypes: ['flat'], priceMax: 185000 },
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id)).toEqual(['rdg-sale-flat-1'])
      })
    })

    describe('search — sort', () => {
      it('"newest" orders by publishedAt descending', async () => {
        const result = await searchIndex.search({
          channel: 'rent',
          sort: 'newest',
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id)).toEqual([...RENT_IDS].reverse())
      })

      it('"price_asc" orders by price ascending', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          sort: 'price_asc',
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id)).toEqual([
          'rdg-sale-flat-1',
          'newbury-sale-flat-1',
          'rdg-sale-flat-2',
          'rdg-sale-bungalow-1',
          'rdg-sale-terraced-1',
          'rdg-sale-semi-1',
          'rdg-sale-detached-1',
          'rdg-sale-flat-luxury',
        ])
      })

      it('"price_desc" orders by price descending', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          sort: 'price_desc',
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.hits.map((h) => h.id)).toEqual([
          'rdg-sale-flat-luxury',
          'rdg-sale-detached-1',
          'rdg-sale-semi-1',
          'rdg-sale-terraced-1',
          'rdg-sale-bungalow-1',
          'rdg-sale-flat-2',
          'newbury-sale-flat-1',
          'rdg-sale-flat-1',
        ])
      })

      it('defaults to "newest" when sort is omitted', async () => {
        const withDefault = await searchIndex.search({
          channel: 'rent',
          hitsPerPage: 50,
          page: 1,
        })
        const withExplicitNewest = await searchIndex.search({
          channel: 'rent',
          sort: 'newest',
          hitsPerPage: 50,
          page: 1,
        })

        expect(withDefault.hits.map((h) => h.id)).toEqual(
          withExplicitNewest.hits.map((h) => h.id),
        )
      })
    })

    describe('search — facets', () => {
      it('propertyType facet counts are exact', async () => {
        const result = await searchIndex.search({
          channel: 'sale',
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.facets.propertyType).toEqual({
          flat: 4,
          terraced: 1,
          detached: 1,
          semi_detached: 1,
          bungalow: 1,
        })
      })

      it('furnished facet counts are exact', async () => {
        const result = await searchIndex.search({
          channel: 'rent',
          hitsPerPage: 50,
          page: 1,
        })

        expect(result.facets.furnished).toEqual({
          furnished: 2,
          unfurnished: 1,
          part_furnished: 1,
        })
      })
    })

    describe('search — pagination', () => {
      it('totals and page counts are exact for a fixed page size', async () => {
        const pageSize = 3
        const first = await searchIndex.search({
          channel: 'sale',
          page: 1,
          hitsPerPage: pageSize,
        })

        expect(first.totalHits).toBe(SALE_IDS.length)
        expect(first.totalPages).toBe(Math.ceil(SALE_IDS.length / pageSize))
        expect(first.page).toBe(1)
        expect(first.hits).toHaveLength(pageSize)

        const lastPage = first.totalPages
        const last = await searchIndex.search({
          channel: 'sale',
          page: lastPage,
          hitsPerPage: pageSize,
        })
        const remainder = SALE_IDS.length % pageSize || pageSize
        expect(last.hits).toHaveLength(remainder)
      })

      it('defaults hitsPerPage to 24 when omitted', async () => {
        const result = await searchIndex.search({ channel: 'sale', page: 1 })
        expect(result.hits.length).toBe(SALE_IDS.length)
        expect(result.totalPages).toBe(1)
      })
    })

    describe('delete', () => {
      it('removes a document so it no longer matches any search', async () => {
        const throwaway: ListingSearchDocument = doc({
          id: 'delete-me',
          channel: 'sale',
          propertyType: 'land',
          town: 'DeleteMeTown',
        })

        await searchIndex.upsert([throwaway])
        const beforeDelete = await searchIndex.search({
          channel: 'sale',
          filters: { town: 'DeleteMeTown' },
          page: 1,
        })
        expect(beforeDelete.hits.map((h) => h.id)).toEqual(['delete-me'])

        const countBefore = await searchIndex.countDocuments()
        await searchIndex.delete(['delete-me'])
        const countAfter = await searchIndex.countDocuments()
        expect(countAfter).toBe(countBefore - 1)

        const afterDelete = await searchIndex.search({
          channel: 'sale',
          filters: { town: 'DeleteMeTown' },
          page: 1,
        })
        expect(afterDelete.hits).toHaveLength(0)
      })
    })
  },
)
