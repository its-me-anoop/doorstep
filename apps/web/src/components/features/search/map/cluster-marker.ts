/**
 * Builds the DOM for one cluster badge (M3-DESIGN-SPEC.md §1.3) — the
 * cluster counterpart to pin-marker.ts; see that module's own doc
 * comment for why this is a plain DOM builder rather than a React
 * component, and why the returned `element` wraps the real visual node
 * instead of being it.
 */

/** Display-only cap (§1.3): "exact count up to 200; 200+ above that —
 * not a functional cap on which listings are queried or clustered." */
const COUNT_DISPLAY_CAP = 200

export function formatClusterCount(count: number): string {
  return count > COUNT_DISPLAY_CAP ? `${COUNT_DISPLAY_CAP}+` : String(count)
}

type ClusterSizeStep = 'small' | 'medium' | 'large'

function sizeStep(count: number): ClusterSizeStep {
  if (count < 10) return 'small'
  if (count < 100) return 'medium'
  return 'large'
}

export interface ClusterHandle {
  /** Hand this straight to the map library's `Marker` constructor. */
  element: HTMLDivElement
}

export function createClusterElement(
  count: number,
  onSelect: () => void,
): ClusterHandle {
  const root = document.createElement('div')

  const cluster = document.createElement('div')
  cluster.className = `cluster cluster--${sizeStep(count)}`
  cluster.textContent = formatClusterCount(count)

  // §4 — same accessibility posture as an individual pin: hidden from
  // the tree, not a tab stop, because clicking through to its expansion
  // zoom reveals the same listings the (fully accessible) list already
  // contains.
  cluster.setAttribute('aria-hidden', 'true')
  cluster.tabIndex = -1

  cluster.addEventListener('click', (event) => {
    event.stopPropagation()
    onSelect()
  })

  root.appendChild(cluster)

  return { element: root }
}
