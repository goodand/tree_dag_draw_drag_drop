import MindMap from 'simple-mind-map/index.js'
import Drag from 'simple-mind-map/src/plugins/Drag.js'
import Select from 'simple-mind-map/src/plugins/Select.js'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js'
import AssociativeLine from 'simple-mind-map/src/plugins/AssociativeLine.js'
import { collectDiagram } from './collect/fromMindMap'
import { toDrawioXml } from './export/drawio'

MindMap.usePlugin(Drag).usePlugin(Select).usePlugin(KeyboardNavigation).usePlugin(AssociativeLine)

const mindMap = new MindMap({
  el: document.getElementById('map') as HTMLElement,
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

// Exposed for manual and E2E verification.
Object.assign(window as any, { mindMap, collectDiagram, toDrawioXml })
