import MindMap from 'simple-mind-map/index.js'
import Drag from 'simple-mind-map/src/plugins/Drag.js'
import Select from 'simple-mind-map/src/plugins/Select.js'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js'
import AssociativeLine from 'simple-mind-map/src/plugins/AssociativeLine.js'
import Export from 'simple-mind-map/src/plugins/Export.js'
import ExportXMind from 'simple-mind-map/src/plugins/ExportXMind.js'
import xmind from 'simple-mind-map/src/parse/xmind.js'
import { collectDiagram } from './collect/fromMindMap'
import { toDrawioXml } from './export/drawio'
import { freeze, unfreeze } from './freeze'
import { applyRelationships, readFirstSheet, withRelationships, type SmmTree } from './xmindLinks'

MindMap.usePlugin(Drag)
  .usePlugin(Select)
  .usePlugin(KeyboardNavigation)
  .usePlugin(AssociativeLine)
  .usePlugin(Export)
  .usePlugin(ExportXMind)

const mapEl = document.getElementById('map') as HTMLElement
// simple-mind-map throws if the container is 0×0 at construction (e.g. a tab
// opened in the background), so wait until it has been laid out.
await new Promise<void>(resolve => {
  const check = (): void => {
    if (mapEl.clientWidth > 0 && mapEl.clientHeight > 0) resolve()
    else requestAnimationFrame(check)
  }
  check()
})

const mindMap = new MindMap({
  el: mapEl,
  layout: 'logicalStructure',
  // XMind-style defaults: English placeholder text, type-to-edit on a selected node.
  defaultInsertSecondLevelNodeText: 'Main Topic',
  defaultInsertBelowSecondLevelNodeText: 'Subtopic',
  defaultGeneralizationText: 'Summary',
  enableAutoEnterTextEditWhenKeydown: true,
  data: {
    data: { text: 'Central Topic' },
    children: [
      { data: { text: 'Main Topic 1' }, children: [] },
      { data: { text: 'Main Topic 2' }, children: [] }
    ]
  }
} as any)

const toolbar = document.getElementById('toolbar') as HTMLElement

const button = (label: string, onClick: () => void): void => {
  const b = document.createElement('button')
  b.textContent = label
  b.addEventListener('click', onClick)
  // Keep focus on the map so keyboard editing keeps working after a click.
  b.addEventListener('mousedown', e => e.preventDefault())
  toolbar.appendChild(b)
}

const download = (name: string, text: string, type: string): void => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

button('Export .drawio', () => {
  download('map.drawio', toDrawioXml(collectDiagram(mindMap)), 'application/xml')
})

// .xmind I/O is the vendored library's own (ExportXMind plugin + parse/xmind);
// we add only the relationships it skips (src/xmindLinks.ts) and the buttons.
async function exportXmind(): Promise<Blob> {
  const tree = mindMap.getData()
  const blob: Blob = await (mindMap as any).doExportXMind.xmind(tree, 'map')
  return withRelationships(blob, tree)
}

async function importXmind(file: Blob): Promise<SmmTree> {
  // The parser handles both ZEN (json) and legacy (xml) files; relationships exist only in ZEN.
  const tree: SmmTree = await xmind.parseXmindFile(file)
  const sheet = await readFirstSheet(file)
  return sheet ? applyRelationships(tree, sheet) : tree
}

button('Export .xmind', async () => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(await exportXmind())
  a.download = 'map.xmind'
  a.click()
  URL.revokeObjectURL(a.href)
})

const picker = document.createElement('input')
picker.type = 'file'
picker.accept = '.xmind'
picker.style.display = 'none'
picker.addEventListener('change', async () => {
  const file = picker.files?.[0]
  if (!file) return
  mindMap.setData(await importXmind(file))
  picker.value = ''
})
document.body.appendChild(picker)
button('Import .xmind', () => picker.click())

let frozen = false
const freezeButton = document.createElement('button')
freezeButton.textContent = 'Freeze'
freezeButton.addEventListener('mousedown', e => e.preventDefault())
freezeButton.addEventListener('click', () => {
  frozen = !frozen
  if (frozen) freeze(mindMap)
  else unfreeze(mindMap)
  freezeButton.textContent = frozen ? 'Unfreeze' : 'Freeze'
  document.body.classList.toggle('frozen', frozen)
})
toolbar.appendChild(freezeButton)

// Exposed for manual and E2E verification.
Object.assign(window as any, { mindMap, collectDiagram, toDrawioXml, freeze, unfreeze, xmind, exportXmind, importXmind })
