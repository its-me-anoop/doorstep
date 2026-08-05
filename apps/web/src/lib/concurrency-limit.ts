/**
 * runWithConcurrencyLimit — pure task scheduler behind the photo grid's
 * upload queue (M1-DESIGN-SPEC.md §1.5): selecting many files at once
 * must not fire 25 simultaneous signed-upload requests. Runs `worker` over
 * `items`, at most `limit` concurrently, preserving each item's result at
 * its original index regardless of completion order.
 *
 * Framework-free and separately unit-tested (no DOM, no fetch) because
 * it's the one piece of the upload pipeline with real ordering/concurrency
 * logic worth proving in isolation from React. Callers whose `worker`
 * represents a real network step (photo-grid.tsx's upload pipeline) are
 * expected to catch their own errors and resolve a tagged
 * success/failure result rather than reject — a rejection here would
 * abort every other in-flight upload via `Promise.all`, which is not the
 * per-tile failure behaviour the spec wants (§1.5: "same tile position
 * preserved, no jarring re-layout").
 */
export async function runWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    const index = nextIndex++
    if (index >= items.length) return
    results[index] = await worker(items[index] as T, index)
    await runNext()
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runNext()))

  return results
}
