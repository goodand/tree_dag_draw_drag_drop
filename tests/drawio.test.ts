import { describe, expect, it } from 'vitest'
import { deflateRaw } from 'pako'
import { toDrawioXml } from '../src/export/drawio'
import { fromDrawioXml } from '../src/import/drawio'
import type { Diagram } from '../src/model/diagram'

const sample: Diagram = {
  nodes: [
    { id: 'root', text: 'Central <Topic> & "friends"', x: 100, y: 200, w: 136, h: 31, fill: '#549688', color: '#fff' },
    { id: 'a', text: 'Main Topic 1', x: 300, y: 120, w: 129, h: 32, parentId: 'root' },
    { id: 'b', text: 'Main Topic 2', x: 300, y: 280, w: 129, h: 32, parentId: 'root' },
    { id: 'c', text: "it's a subtopic", x: 500, y: 280, w: 95, h: 32, parentId: 'b', stroke: '#ff0000' }
  ],
  links: [{ id: 'l1', source: 'a', target: 'c', text: 'depends on' }]
}

describe('draw.io round-trip', () => {
  it('export → import preserves nodes, geometry, tree and links', () => {
    const xml = toDrawioXml(sample)
    expect(fromDrawioXml(xml)).toEqual(sample)
  })

  it('emits the mxGraphModel skeleton draw.io expects', () => {
    const xml = toDrawioXml(sample)
    expect(xml).toContain('<mxfile ')
    expect(xml).toContain('<mxCell id="0"/><mxCell id="1" parent="0"/>')
    expect(xml).toContain('vertex="1" parent="1"')
    expect(xml).toContain('edge="1" parent="1" source="root" target="a"')
    // one tree edge per non-root node, one edge per link
    expect(xml.match(/edge="1"/g)).toHaveLength(3 + 1)
  })

  it('escapes XML special characters in labels', () => {
    const xml = toDrawioXml(sample)
    expect(xml).toContain('label="Central &lt;Topic&gt; &amp; &quot;friends&quot;"')
    expect(xml).toContain('label="it&#39;s a subtopic"')
    expect(xml).not.toContain('<Topic>')
  })

  it('imports a compressed <diagram> payload as saved by draw.io', () => {
    const plain = toDrawioXml(sample)
    const model = plain.slice(plain.indexOf('<mxGraphModel'), plain.indexOf('</mxGraphModel>') + '</mxGraphModel>'.length)
    const payload = btoa(String.fromCharCode(...deflateRaw(encodeURIComponent(model))))
    const compressed = `<mxfile><diagram name="Page-1" id="p1">${payload}</diagram></mxfile>`
    expect(fromDrawioXml(compressed)).toEqual(sample)
  })

  it('imports a plain draw.io file (no metadata) as free nodes with links', () => {
    const xml =
      '<mxfile><diagram id="d" name="x"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="n1" value="A" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell>' +
      '<mxCell id="n2" value="B" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="200" y="20" width="80" height="40" as="geometry"/></mxCell>' +
      '<mxCell id="e1" style="" edge="1" parent="1" source="n1" target="n2"><mxGeometry relative="1" as="geometry"/></mxCell>' +
      '</root></mxGraphModel></diagram></mxfile>'
    const d = fromDrawioXml(xml)
    expect(d.nodes.map(n => n.parentId)).toEqual([undefined, undefined])
    expect(d.links).toEqual([{ id: 'e1', source: 'n1', target: 'n2', text: undefined }])
  })
})
