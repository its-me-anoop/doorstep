import { describe, expect, it } from 'vitest'

import { runWithConcurrencyLimit } from '@/lib/concurrency-limit'

describe('runWithConcurrencyLimit', () => {
  it('runs every item and returns results in input order regardless of completion order', async () => {
    const items = [30, 10, 20]
    const results = await runWithConcurrencyLimit(items, 3, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, item))
      return item * 2
    })

    expect(results).toEqual([60, 20, 40])
  })

  it('never runs more than `limit` workers at once', async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 6 }, (_, i) => i)

    await runWithConcurrencyLimit(items, 2, async (item) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return item
    })

    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it('passes each item and its index to the worker', async () => {
    const seen: Array<[string, number]> = []
    await runWithConcurrencyLimit(['a', 'b', 'c'], 1, async (item, index) => {
      seen.push([item, index])
      return null
    })

    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ])
  })

  it('resolves to an empty array for an empty input, without calling the worker', async () => {
    let called = false
    const results = await runWithConcurrencyLimit([], 3, async () => {
      called = true
      return null
    })

    expect(results).toEqual([])
    expect(called).toBe(false)
  })

  it('caps concurrency at the item count when the limit is larger', async () => {
    const results = await runWithConcurrencyLimit(
      [1, 2],
      10,
      async (item) => item,
    )
    expect(results).toEqual([1, 2])
  })
})
