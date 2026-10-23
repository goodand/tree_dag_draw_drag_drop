import MindMap from 'simple-mind-map/index.js'
import Drag from 'simple-mind-map/src/plugins/Drag.js'
import Select from 'simple-mind-map/src/plugins/Select.js'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js'
import AssociativeLine from 'simple-mind-map/src/plugins/AssociativeLine.js'
import { collectDiagram } from './collect/fromMindMap'
import { toDrawioXml } from './export/drawio'
import { freeze, unfreeze } from './freeze'

MindMap.usePlugin(Drag).usePlugin(Select).usePlugin(KeyboardNavigation).usePlugin(AssociativeLine)

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
Object.assign(window as any, { mindMap, collectDiagram, toDrawioXml, freeze, unfreeze })
