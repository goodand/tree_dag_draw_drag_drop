// The vendored xmind converter writes topic ids (= node uids) but ignores XMind
// `relationships` in both directions. These helpers add that one piece around
// it: relationships ⇄ simple-mind-map associative lines. Pure functions first
// (unit-tested), zip wrappers below.
import JSZip from 'jszip'

export interface SmmTree {
  data: { uid?: string; text?: string; associativeLineTargets?: string[]; associativeLineText?: Record<string, string>; [k: string]: unknown }
  children: SmmTree[]
}
export interface XmindTopic {
  id?: string
  title?: string
  children?: { attached?: XmindTopic[] }
}
export interface XmindRelationship {
  id: string
  class: 'relationship'
  end1Id: string
  end2Id: string
  title?: string
}
export interface XmindSheet {
  rootTopic: XmindTopic
  relationships?: XmindRelationship[]
  [k: string]: unknown
}

/** Collect associative lines of a tree as XMind relationships. */
export function relationshipsFromTree(tree: SmmTree): XmindRelationship[] {
  const out: XmindRelationship[] = []
  const walk = (n: SmmTree): void => {
    const from = n.data.uid
    if (from) {
      for (const to of n.data.associativeLineTargets ?? []) {
        const title = n.data.associativeLineText?.[to]
        out.push({ id: `rel-${from}-${to}`, class: 'relationship', end1Id: from, end2Id: to, ...(title ? { title } : {}) })
      }
    }
    n.children.forEach(walk)
  }
  walk(tree)
  return out
}

/**
 * Restore uids from topic ids and relationships as associative lines.
 * `tree` is the converter's output for `sheet`, so both have the same shape
 * and child order; we walk them in lockstep.
 */
export function applyRelationships(tree: SmmTree, sheet: XmindSheet): SmmTree {
  const walk = (n: SmmTree, t: XmindTopic): void => {
    if (t.id) n.data.uid = t.id
    const attached = t.children?.attached ?? []
    n.children.forEach((c, i) => attached[i] && walk(c, attached[i]))
  }
  walk(tree, sheet.rootTopic)

  const byUid = new Map<string, SmmTree>()
  const index = (n: SmmTree): void => {
    if (n.data.uid) byUid.set(n.data.uid, n)
    n.children.forEach(index)
  }
  index(tree)

  for (const r of sheet.relationships ?? []) {
    const from = byUid.get(r.end1Id)
    if (!from || !byUid.has(r.end2Id)) continue
    const targets = (from.data.associativeLineTargets ??= [])
    if (!targets.includes(r.end2Id)) targets.push(r.end2Id)
    if (r.title) (from.data.associativeLineText ??= {})[r.end2Id] = r.title
  }
  return tree
}

/** Take the converter's .xmind blob and add relationships to its first sheet. */
export async function withRelationships(blob: Blob, tree: SmmTree): Promise<Blob> {
  const zip = await JSZip.loadAsync(blob)
  const sheets = JSON.parse(await zip.file('content.json')!.async('string')) as XmindSheet[]
  const rels = relationshipsFromTree(tree)
  if (rels.length) sheets[0].relationships = rels
  zip.file('content.json', JSON.stringify(sheets))
  return zip.generateAsync({ type: 'blob' })
}

/** Read the first sheet of a ZEN-format .xmind (null for legacy XML files). */
export async function readFirstSheet(file: Blob): Promise<XmindSheet | null> {
  const zip = await JSZip.loadAsync(file)
  const content = zip.file('content.json')
  if (!content) return null
  return (JSON.parse(await content.async('string')) as XmindSheet[])[0] ?? null
}
