import { describe, expect, it } from 'vitest'
import { sharedLinkLabel, unifiedLinkTheme } from '../src/linkStyle'
import type { SmmTree } from '../src/xmindLinks'

const node = (uid: string, data: Partial<SmmTree['data']> = {}, children: SmmTree[] = []): SmmTree =>
  ({ data: { uid, text: uid, ...data }, children })

describe('unifiedLinkTheme', () => {
  it('copies the tree line colour and width and turns dashes off', () => {
    expect(unifiedLinkTheme({ lineColor: '#549688', lineWidth: 1 })).toEqual({
      associativeLineColor: '#549688', associativeLineWidth: 1, associativeLineDasharray: 'none',
    })
  })
})

describe('sharedLinkLabel', () => {
  it('returns the label when every cross link carries the same one', () => {
    const t = node('r', {}, [
      node('a', { associativeLineTargets: ['b'], associativeLineText: { b: '수단→목적' } }),
      node('b', { associativeLineTargets: ['r'], associativeLineText: { r: '수단→목적' } }),
    ])
    expect(sharedLinkLabel(t)).toBe('수단→목적')
  })
  it('returns null when labels differ, so they stay on the lines', () => {
    const t = node('r', {}, [
      node('a', { associativeLineTargets: ['b'], associativeLineText: { b: '수단→목적' } }),
      node('b', { associativeLineTargets: ['r'], associativeLineText: { r: '원인' } }),
    ])
    expect(sharedLinkLabel(t)).toBeNull()
  })
  it('treats an unlabelled link as different from a labelled one', () => {
    const t = node('r', {}, [
      node('a', { associativeLineTargets: ['b', 'r'], associativeLineText: { b: '수단→목적' } }),
      node('b'),
    ])
    expect(sharedLinkLabel(t)).toBeNull()
  })
  it('returns null without cross links', () => {
    expect(sharedLinkLabel(node('r', {}, [node('a')]))).toBeNull()
  })
})
