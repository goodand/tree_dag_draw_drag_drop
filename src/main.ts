import MindMap from 'simple-mind-map/index.js'
import Drag from 'simple-mind-map/src/plugins/Drag.js'
import Select from 'simple-mind-map/src/plugins/Select.js'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js'
import AssociativeLine from 'simple-mind-map/src/plugins/AssociativeLine.js'

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

// Exposed for manual and E2E verification.
;(window as any).mindMap = mindMap
