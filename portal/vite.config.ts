import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/portal/',
  plugins: [
    react(),
  ],
  server: {
    host: true,
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
