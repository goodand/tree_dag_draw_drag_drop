import { describe, expect, it } from 'vitest'
import { layoutDag, fromDiagram, ends } from '../src/dag/layout.js'
import { toDrawio, toSvg, bounds } from '../src/dag/render.js'
import type { Diagram } from '../src/model/diagram'

const box = (id: string, parentId?: string) => ({ id, text: id, x: 0, y: 0, w: 60, h: 20, parentId })
// purpose -> means tree plus two cross links (source = means, target = purpose)
const diagram: Diagram = {
  nodes: [box('root'), box('a', 'root'), box('b', 'root'), box('c', 'a'), box('d', 'c'), box('e', 'b'), box('f', 'e')],
  links: [{ id: 'x0', source: 'c', target: 'b' }, { id: 'x1', source: 'd', target: 'root' }],
}

describe('DAG view layout', () => {
  it('turns tree edges and cross links into one left-to-right edge list', () => {
    const g = fromDiagram(diagram)
    expect(g.edges).toContainEqual({ from: 'b', to: 'c' })
    expect(g.edges).toContainEqual({ from: 'root', to: 'd' })
    expect(g.nodes.find((n: any) => n.id === 'root').kind).toBe('root')
    expect(g.nodes.find((n: any) => n.id === 'a').kind).toBe('main')
  })

  it('keeps the hard rules: no overlap, no line through a box, ends on side midpoints', async () => {
    const res = await layoutDag(fromDiagram(diagram))
    expect(res.metrics.overlaps).toEqual([])
    expect(res.metrics.boxHits).toEqual([])
    expect(res.metrics.offMidpoint).toEqual([])
    const by = Object.fromEntries(res.nodes.map((n: any) => [n.id, n]))
    const r = res.routes.find((x: any) => x.id === 'b->c')
    expect([r.points[0], r.points.at(-1)]).toEqual(ends(by.b, by.c))
  })

  it('exports every node and edge to draw.io with stable ids', async () => {
    const xml = toDrawio(await layoutDag(fromDiagram(diagram)))
    expect(xml.match(/vertex="1"/g)).toHaveLength(7)
    expect(xml.match(/edge="1"/g)).toHaveLength(8)
    expect(xml).toContain('id="e:root-&gt;d"')
  })

  it('draws DDS goal_means: arrowhead on the purpose end, no meaning in fill, equal 24px margin', async () => {
    const res = await layoutDag(fromDiagram(diagram))
    const svg = toSvg(res)
    expect(svg.match(/<polyline /g)).toHaveLength(8)
    expect(svg.match(/marker-start="url\(#purpose\)"/g)).toHaveLength(8)
    expect(svg).not.toMatch(/<rect x="\d[^>]*fill="(?!#fafafa)/)          // every box is unfilled (paper colour)
    const b = bounds(res)
    const minX = Math.min(...res.nodes.map((n: any) => n.x), ...res.routes.flatMap((r: any) => r.points.map((q: any) => q.x)))
    expect(minX - b.x).toBe(24)
    const xml = toDrawio(res)
    expect(xml.match(/startArrow=block;startFill=1;endArrow=none/g)).toHaveLength(8)
  })
})
