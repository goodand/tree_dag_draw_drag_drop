// Cross links (associative lines) are the same kind of relation as tree edges, so they are drawn the same way:
// tree colour and width, solid. A per-line label is shown only when it says something the others do not;
// when every cross link carries the same label it moves to a single legend instead.
import type { SmmTree } from './xmindLinks'

export interface TreeLineTheme { lineColor: string; lineWidth: number }

/** themeConfig entries that make associative lines look like tree lines. */
export function unifiedLinkTheme(tree: TreeLineTheme): Record<string, string | number> {
  return {
    associativeLineColor: tree.lineColor,
    associativeLineWidth: tree.lineWidth,
    associativeLineDasharray: 'none',
  }
}

/**
 * The label every cross link shares, or null when there are no cross links or their labels differ
 * (an unlabelled link counts as a different label).
 */
export function sharedLinkLabel(tree: SmmTree): string | null {
  const labels = new Set<string>()
  let count = 0
  const walk = (n: SmmTree): void => {
    for (const to of n.data.associativeLineTargets ?? []) {
      count++
      labels.add(n.data.associativeLineText?.[to] ?? '')
    }
    n.children.forEach(walk)
  }
  walk(tree)
  if (count === 0 || labels.size !== 1) return null
  const [only] = labels
  return only === '' ? null : only
}
