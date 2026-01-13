import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Portal app vite config - builds to /portal path
export default defineConfig({
  plugins: [react()],
  base: '/portal/',
  build: {
    outDir: 'dist-portal',
    emptyOutDir: true,
  },
  server: {
    middlewareMode: false,
  }
})
