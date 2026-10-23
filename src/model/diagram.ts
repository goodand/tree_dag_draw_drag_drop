// Format-neutral snapshot of a rendered map. This is the only shape the
// draw.io and Freeze layers see, so they stay independent of simple-mind-map.

export interface DiagramNode {
  id: string
  text: string
  /** Top-left corner in map coordinates. */
  x: number
  y: number
  w: number
  h: number
  /** Tree parent; undefined for the root or for free (frozen) nodes. */
  parentId?: string
  fill?: string
  stroke?: string
  color?: string
}

export interface DiagramLink {
  id: string
  source: string
  target: string
  text?: string
}

export interface Diagram {
  nodes: DiagramNode[]
  /** Cross links (XMind relationships / simple-mind-map associative lines). Tree edges are implied by parentId. */
  links: DiagramLink[]
}
