import { xml2js, type Element } from 'xml-js'
import { inflateRaw } from 'pako'
import type { Diagram, DiagramLink, DiagramNode } from '../model/diagram'
import { ATTR_KIND, ATTR_PARENT } from '../export/drawio'

const attrs = (e: Element): Record<string, string> =>
  Object.fromEntries(Object.entries(e.attributes ?? {}).map(([k, v]) => [k, String(v)]))

const children = (e: Element | undefined, name: string): Element[] =>
  (e?.elements ?? []).filter(c => c.type === 'element' && c.name === name)

const styleValue = (style: string, key: string): string | undefined =>
  style.split(';').map(p => p.split('=')).find(([k]) => k === key)?.[1]

/** draw.io may store <diagram> as deflate+base64+URL-encoded text instead of child elements. */
function decodeDiagram(diagram: Element): Element {
  const direct = children(diagram, 'mxGraphModel')[0]
  if (direct) return direct
  const text = (diagram.elements ?? []).find(c => c.type === 'text')?.text
  if (!text) throw new Error('drawio: <diagram> has no mxGraphModel and no compressed payload')
  const bytes = Uint8Array.from(atob(String(text).trim()), c => c.charCodeAt(0))
  const xml = decodeURIComponent(inflateRaw(bytes, { to: 'string' }))
  const model = children(xml2js(xml) as Element, 'mxGraphModel')[0]
  if (!model) throw new Error('drawio: compressed payload is not an mxGraphModel')
  return model
}

/**
 * Parse a .drawio file into a Diagram. With our <object> metadata the tree is
 * restored exactly; a plain draw.io file yields free nodes plus links for every edge.
 */
export function fromDrawioXml(xml: string): Diagram {
  const doc = xml2js(xml) as Element
  const mxfile = children(doc, 'mxfile')[0]
  const diagram = children(mxfile, 'diagram')[0]
  if (!diagram) throw new Error('drawio: no <diagram> found')
  const root = children(decodeDiagram(diagram), 'root')[0]

  const nodes: DiagramNode[] = []
  const links: DiagramLink[] = []
  const treeEdges: { source: string; target: string }[] = []

  for (const el of root.elements ?? []) {
    if (el.type !== 'element') continue
    let cell: Element | undefined
    let meta: Record<string, string> = {}
    if (el.name === 'object') {
      meta = attrs(el)
      cell = children(el, 'mxCell')[0]
    } else if (el.name === 'mxCell') {
      cell = el
    }
    if (!cell) continue
    const a = attrs(cell)
    const id = meta.id ?? a.id
    const label = meta.label ?? a.value ?? ''
    if (a.vertex === '1') {
      const g = attrs(children(cell, 'mxGeometry')[0] ?? { type: 'element', name: 'mxGeometry' })
      const style = a.style ?? ''
      nodes.push({
        id,
        text: label,
        x: Number(g.x ?? 0),
        y: Number(g.y ?? 0),
        w: Number(g.width ?? 0),
        h: Number(g.height ?? 0),
        parentId: meta[ATTR_PARENT] || undefined,
        fill: styleValue(style, 'fillColor'),
        stroke: styleValue(style, 'strokeColor'),
        color: styleValue(style, 'fontColor')
      })
    } else if (a.edge === '1' && a.source && a.target) {
      if (meta[ATTR_KIND] === 'tree') treeEdges.push({ source: a.source, target: a.target })
      else links.push({ id, source: a.source, target: a.target, text: label || undefined })
    }
  }

  // Tree edges without metadata on the vertex (file edited in draw.io) still restore parentId.
  const byId = new Map(nodes.map(n => [n.id, n]))
  for (const e of treeEdges) {
    const child = byId.get(e.target)
    if (child && !child.parentId) child.parentId = e.source
  }
  return { nodes, links }
}
