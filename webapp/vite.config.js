import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Must match the GitHub Pages repo subpath so asset URLs resolve correctly in production.
  base: '/Project-Harvest/',
})
