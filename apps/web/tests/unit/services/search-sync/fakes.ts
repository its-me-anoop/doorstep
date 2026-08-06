/**
 * In-memory fakes for services/search-sync/*'s TDD suite (PRD §8.5).
 * FakeListingRepository (tests/unit/services/listings/fakes.ts),
 * FakePropertyImageRepository (tests/unit/services/images/fakes.ts) and
 * FakeAgencyRepository (tests/unit/services/listers/fakes.ts) are reused
 * unchanged for the ListingReader/PropertyImageReader/AgencyRepository
 * halves both services here need — only OutboxRepository and SearchIndex
 * are new to this suite.
 */

import type { OutboxOp } from '@/domain/enums'
import type { OutboxEntry, OutboxRepository } from '@/ports/outbox-repository'
import type {
  ListingSearchDocument,
  SearchFacetCounts,
  SearchIndex,
  SearchQuery,
  SearchResult,
} from '@/ports/search-index'

export class FakeOutboxRepository implements OutboxRepository {
  private readonly rows = new Map<
    string,
    { entry: OutboxEntry; processed: boolean }
  >()
  private nextId = 1

  /** Test helper: seed a pending row directly, bypassing the transactional
   * write a real listing mutation would make. */
  enqueue(
    propertyId: string,
    op: OutboxOp,
    enqueuedAt: Date = new Date(this.nextId),
  ): OutboxEntry {
    const entry: OutboxEntry = {
      id: `outbox-${this.nextId++}`,
      propertyId,
      op,
      enqueuedAt,
    }
    this.rows.set(entry.id, { entry, processed: false })
    return entry
  }

  async claimBatch(limit: number): Promise<OutboxEntry[]> {
    return [...this.rows.values()]
      .filter((row) => !row.processed)
      .sort(
        (a, b) => a.entry.enqueuedAt.getTime() - b.entry.enqueuedAt.getTime(),
      )
      .slice(0, limit)
      .map((row) => row.entry)
  }

  async markProcessed(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.get(id)
      if (row) row.processed = true
    }
  }

  async countPending(): Promise<number> {
    return [...this.rows.values()].filter((row) => !row.processed).length
  }
}

const EMPTY_FACETS: SearchFacetCounts = { propertyType: {} }

export class FakeSearchIndex implements SearchIndex {
  readonly documents = new Map<string, ListingSearchDocument>()
  readonly upsertCalls: ListingSearchDocument[][] = []
  readonly deleteCalls: string[][] = []
  ensureSettingsCallCount = 0
  clearCallCount = 0
  /** The most recent query passed to `search()` — lets
   * tests/unit/services/search/search-listings.test.ts assert on the
   * SearchQuery a translation step built, without every test having to
   * override `search` itself. */
  lastSearchQuery: SearchQuery | undefined
  private pendingUpsertError: Error | null = null
  private pendingDeleteError: Error | null = null
  private countOverride: number | null = null

  async ensureSettings(): Promise<void> {
    this.ensureSettingsCallCount += 1
  }

  async upsert(documents: ListingSearchDocument[]): Promise<void> {
    this.upsertCalls.push(documents)
    if (this.pendingUpsertError) {
      const error = this.pendingUpsertError
      this.pendingUpsertError = null
      throw error
    }
    for (const document of documents) this.documents.set(document.id, document)
  }

  async delete(ids: string[]): Promise<void> {
    this.deleteCalls.push(ids)
    if (this.pendingDeleteError) {
      const error = this.pendingDeleteError
      this.pendingDeleteError = null
      throw error
    }
    for (const id of ids) this.documents.delete(id)
  }

  async clear(): Promise<void> {
    this.clearCallCount += 1
    this.documents.clear()
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    this.lastSearchQuery = query
    return {
      hits: [...this.documents.values()],
      totalHits: this.documents.size,
      page: 1,
      totalPages: 1,
      facets: EMPTY_FACETS,
    }
  }

  async countDocuments(): Promise<number> {
    return this.countOverride ?? this.documents.size
  }

  async healthy(): Promise<boolean> {
    return true
  }

  /** Test helper: the very next upsert()/delete() call throws `error`
   * instead of applying — mirrors FakeAgencyRepository's
   * runBeforeNextCreate one-shot-hook shape. */
  failNextUpsert(error: Error): void {
    this.pendingUpsertError = error
  }

  failNextDelete(error: Error): void {
    this.pendingDeleteError = error
  }

  /** Test helper: makes countDocuments() report a value independent of
   * `documents.size` — the only way to exercise
   * RebuildSearchIndex's drift reporting against a genuine mismatch
   * without a real sync bug to reproduce one. */
  setCountOverride(count: number | null): void {
    this.countOverride = count
  }
}
