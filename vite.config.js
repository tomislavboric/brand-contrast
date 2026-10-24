import { defineConfig } from 'vite'

// The demo lives in ./demo and imports the library straight from ./src.
// `base` matches the GitHub Pages project path.
export default defineConfig({
  root: 'demo',
  base: '/brand-contrast/',
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
  },
})
