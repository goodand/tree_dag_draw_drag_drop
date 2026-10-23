// Freeze = pin every node at its current layout position so the map becomes a
// set of free objects (drag anywhere, keep cross links) — the XMind→draw.io
// "object" stage. Unfreeze clears the pins and the layout engine takes over again.
//
// simple-mind-map treats a node as free once both customLeft/customTop are set
// (MindMapNode.hasCustomPosition). Children of a free node are still laid out
// relative to it, so we pin every node, not only the roots of a subtree.

interface SmmNode {
  left: number
  top: number
  customLeft?: number
  customTop?: number
  children: SmmNode[]
}
interface SmmMindMap {
  opt: { enableFreeDrag: boolean; beforeDragEnd?: (info: DragEndInfo) => boolean | Promise<boolean> }
  renderer: { root: SmmNode; resetLayout(): void }
  execCommand(name: 'SET_NODE_CUSTOM_POSITION', node: SmmNode, left: number, top: number): void
  render(): void
}
interface DragEndInfo {
  overlapNodeUid?: string
  prevNodeUid?: string
  nextNodeUid?: string
}

/** Pins to apply for a node at (left, top). The library drops a 0 via `||`, so nudge it to 1. */
export const pinnedPosition = (left: number, top: number): [number, number] => [left || 1, top || 1]

export function freeze(mindMap: SmmMindMap): void {
  const walk = (n: SmmNode): void => {
    // Read before writing: the getter returns the layout value until a pin exists.
    const [l, t] = pinnedPosition(n.left, n.top)
    // Persist in node data (survives re-render/export) and on the instance
    // (what the layout reads now) — same pair of writes Drag.js does.
    mindMap.execCommand('SET_NODE_CUSTOM_POSITION', n, l, t)
    n.customLeft = l
    n.customTop = t
    n.children.forEach(walk)
  }
  walk(mindMap.renderer.root)
  mindMap.render()
  mindMap.opt.enableFreeDrag = true
  // While frozen a drop onto another node must not re-parent; cancel it instead.
  mindMap.opt.beforeDragEnd = info => Boolean(info.overlapNodeUid || info.prevNodeUid || info.nextNodeUid)
}

export function unfreeze(mindMap: SmmMindMap): void {
  mindMap.renderer.resetLayout()
  mindMap.opt.enableFreeDrag = false
  mindMap.opt.beforeDragEnd = undefined
}
