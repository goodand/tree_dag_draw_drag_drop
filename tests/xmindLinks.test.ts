import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { applyRelationships, readFirstSheet, relationshipsFromTree, withRelationships, type SmmTree, type XmindSheet } from '../src/xmindLinks'

const tree: SmmTree = {
  data: { uid: 'root', text: 'Central' },
  children: [
    { data: { uid: 'a', text: 'A', associativeLineTargets: ['c'], associativeLineText: { c: 'depends on' } }, children: [] },
    { data: { uid: 'b', text: 'B' }, children: [{ data: { uid: 'c', text: 'C' }, children: [] }] }
  ]
}

// What the vendored converter emits for `tree` (ids = uids, same child order).
const sheet: XmindSheet = {
  rootTopic: {
    id: 'root',
    title: 'Central',
    children: { attached: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B', children: { attached: [{ id: 'c', title: 'C' }] } }] }
  }
}

// What the converter yields when reading `sheet` back: no uids, no links.
const parsedBack = (): SmmTree => ({
  data: { text: 'Central' },
  children: [
    { data: { text: 'A' }, children: [] },
    { data: { text: 'B' }, children: [{ data: { text: 'C' }, children: [] }] }
  ]
})

describe('xmind relationships', () => {
  it('collects associative lines as relationships with titles', () => {
    expect(relationshipsFromTree(tree)).toEqual([
      { id: 'rel-a-c', class: 'relationship', end1Id: 'a', end2Id: 'c', title: 'depends on' }
    ])
  })

  it('restores uids and links onto the parsed tree', () => {
    const restored = applyRelationships(parsedBack(), { ...sheet, relationships: relationshipsFromTree(tree) })
    expect(restored).toEqual(tree)
  })

  it('ignores relationships whose ends are missing', () => {
    const restored = applyRelationships(parsedBack(), {
      ...sheet,
      relationships: [{ id: 'x', class: 'relationship', end1Id: 'a', end2Id: 'nope' }]
    })
    expect(restored.children[0].data.associativeLineTargets).toBeUndefined()
  })

  it('round-trips through the zip: blob → +relationships → first sheet', async () => {
    const zip = new JSZip()
    zip.file('content.json', JSON.stringify([sheet]))
    const blob = await zip.generateAsync({ type: 'blob' })
    const patched = await withRelationships(blob, tree)
    const first = await readFirstSheet(patched)
    expect(first?.relationships).toEqual(relationshipsFromTree(tree))
    expect(first?.rootTopic).toEqual(sheet.rootTopic)
  })

  it('returns null for a legacy (content.xml) workbook', async () => {
    const zip = new JSZip()
    zip.file('content.xml', '<xmap-content/>')
    expect(await readFirstSheet(await zip.generateAsync({ type: 'blob' }))).toBeNull()
  })
})
