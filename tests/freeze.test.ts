import { describe, expect, it } from 'vitest'
import { freeze, unfreeze, pinnedPosition } from '../src/freeze'

// Fake of the simple-mind-map surface freeze() touches: a tree whose `left/top`
// getters prefer a pin (customLeft/customTop) over the layout value, exactly as
// MindMapNode does, so the test exercises the same read-before-write order.
function fakeNode(left: number, top: number, children: any[] = []) {
  const n: any = { _left: left, _top: top, customLeft: undefined, customTop: undefined, children }
  Object.defineProperty(n, 'left', { get: () => n.customLeft || n._left })
  Object.defineProperty(n, 'top', { get: () => n.customTop || n._top })
  return n
}

function fakeMindMap(root: any) {
  const all: any[] = []
  const walk = (n: any) => { all.push(n); n.children.forEach(walk) }
  walk(root)
  return {
    all,
    opt: { enableFreeDrag: false, beforeDragEnd: undefined as any },
    renderer: { root, resetLayout: () => all.forEach(n => { n.customLeft = n.customTop = undefined }) },
    execCommand: (_name: string, node: any, l: number, t: number) => { node.data = { customLeft: l, customTop: t } },
    render: () => {}
  }
}

describe('freeze', () => {
  it('pins every node at its current layout position', () => {
    const root = fakeNode(100, 200, [fakeNode(300, 120), fakeNode(300, 280, [fakeNode(500, 280)])])
    const mm = fakeMindMap(root)
    const before = mm.all.map(n => [n.left, n.top])
    freeze(mm as any)
    expect(mm.all.every(n => n.customLeft !== undefined && n.customTop !== undefined)).toBe(true)
    // persisted in node data too, so it survives a re-render
    expect(mm.all.every(n => n.data.customLeft === n.customLeft && n.data.customTop === n.customTop)).toBe(true)
    expect(mm.all.map(n => [n.left, n.top])).toEqual(before)
    expect(mm.opt.enableFreeDrag).toBe(true)
  })

  it('nudges 0 so the library does not drop the pin', () => {
    expect(pinnedPosition(0, 0)).toEqual([1, 1])
    expect(pinnedPosition(40, 0)).toEqual([40, 1])
  })

  it('cancels re-parenting drops while frozen, allows free drops', () => {
    const mm = fakeMindMap(fakeNode(10, 10))
    freeze(mm as any)
    expect(mm.opt.beforeDragEnd({ overlapNodeUid: 'x' })).toBe(true)
    expect(mm.opt.beforeDragEnd({ prevNodeUid: 'x' })).toBe(true)
    expect(mm.opt.beforeDragEnd({})).toBe(false)
  })

  it('unfreeze clears pins and restores tree dragging', () => {
    const mm = fakeMindMap(fakeNode(10, 10, [fakeNode(50, 50)]))
    freeze(mm as any)
    unfreeze(mm as any)
    expect(mm.all.every(n => n.customLeft === undefined)).toBe(true)
    expect(mm.opt.enableFreeDrag).toBe(false)
    expect(mm.opt.beforeDragEnd).toBeUndefined()
  })
})
