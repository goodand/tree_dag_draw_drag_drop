import type { Diagram, DiagramNode } from '../model/diagram'

// Custom attributes carried on <object> wrappers so a file edited in draw.io
// can still be re-imported with its tree structure intact.
export const ATTR_KIND = 'tdKind'
export const ATTR_PARENT = 'tdParent'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const vertexStyle = (n: DiagramNode): string => {
  const parts = ['rounded=1', 'whiteSpace=wrap', 'html=1']
  if (n.fill) parts.push(`fillColor=${n.fill}`)
  if (n.stroke) parts.push(`strokeColor=${n.stroke}`)
  if (n.color) parts.push(`fontColor=${n.color}`)
  return parts.join(';') + ';'
}

const TREE_EDGE_STYLE = 'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=none;'
const LINK_EDGE_STYLE = 'edgeStyle=none;curved=1;html=1;dashed=1;endArrow=classic;'

const vertex = (n: DiagramNode): string =>
  `<object label="${esc(n.text)}" ${ATTR_KIND}="topic"${n.parentId ? ` ${ATTR_PARENT}="${esc(n.parentId)}"` : ''} id="${esc(n.id)}">` +
  `<mxCell style="${vertexStyle(n)}" vertex="1" parent="1">` +
  `<mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/>` +
  `</mxCell></object>`

const edge = (id: string, kind: 'tree' | 'link', source: string, target: string, style: string, label = ''): string =>
  `<object label="${esc(label)}" ${ATTR_KIND}="${kind}" id="${esc(id)}">` +
  `<mxCell style="${style}" edge="1" parent="1" source="${esc(source)}" target="${esc(target)}">` +
  `<mxGeometry relative="1" as="geometry"/>` +
  `</mxCell></object>`

/** Serialize a Diagram as an uncompressed .drawio file (draw.io opens these directly). */
export function toDrawioXml(d: Diagram, name = 'Page-1'): string {
  const cells: string[] = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
  for (const n of d.nodes) cells.push(vertex(n))
  for (const n of d.nodes) {
    if (n.parentId) cells.push(edge(`tree-${n.id}`, 'tree', n.parentId, n.id, TREE_EDGE_STYLE))
  }
  for (const l of d.links) cells.push(edge(l.id, 'link', l.source, l.target, LINK_EDGE_STYLE, l.text ?? ''))
  return (
    `<mxfile host="tree-dag-diagram" type="device">` +
    `<diagram name="${esc(name)}" id="${esc(name)}">` +
    `<mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827">` +
    `<root>${cells.join('')}</root>` +
    `</mxGraphModel></diagram></mxfile>`
  )
}
