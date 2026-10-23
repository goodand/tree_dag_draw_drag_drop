import type { Diagram, DiagramLink, DiagramNode } from '../model/diagram'

// Minimal view of the simple-mind-map objects we read. Kept local so the rest
// of the app never depends on the vendored library's (untyped) internals.
interface SmmNode {
  uid: string
  left: number
  top: number
  width: number
  height: number
  children: SmmNode[]
  getData(key?: string): any
  getStyle(prop: string, root?: boolean): string
}
interface SmmMindMap {
  renderer: { root: SmmNode }
}

/** Snapshot the rendered tree, using the layout engine's coordinates as-is. */
export function collectDiagram(mindMap: SmmMindMap): Diagram {
  const nodes: DiagramNode[] = []
  const links: DiagramLink[] = []
  // draw.io spells "no fill" as none; simple-mind-map uses transparent.
  const color = (v: string): string | undefined => (v === '' ? undefined : v === 'transparent' ? 'none' : v)

  const walk = (n: SmmNode, parentId?: string): void => {
    nodes.push({
      id: n.uid,
      text: String(n.getData('text') ?? ''),
      x: Math.round(n.left),
      y: Math.round(n.top),
      w: Math.round(n.width),
      h: Math.round(n.height),
      parentId,
      fill: color(n.getStyle('fillColor')),
      stroke: color(n.getStyle('borderColor')),
      color: color(n.getStyle('color'))
    })
    const targets: string[] = n.getData('associativeLineTargets') ?? []
    const texts: Record<string, string> = n.getData('associativeLineText') ?? {}
    targets.forEach((target, i) => {
      links.push({ id: `link-${n.uid}-${i}`, source: n.uid, target, text: texts[target] || undefined })
    })
    for (const c of n.children) walk(c, n.uid)
  }
  walk(mindMap.renderer.root)

  // Normalize so the top-left of the map lands near the page origin.
  const minX = Math.min(...nodes.map(n => n.x))
  const minY = Math.min(...nodes.map(n => n.y))
  for (const n of nodes) {
    n.x -= minX - 40
    n.y -= minY - 40
  }
  return { nodes, links }
}
