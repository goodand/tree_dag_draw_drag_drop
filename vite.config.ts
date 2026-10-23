import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const vendor = fileURLToPath(new URL('./vendor/simple-mind-map', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [{ find: /^simple-mind-map(\/.*)?$/, replacement: `${vendor}$1` }]
  }
})
