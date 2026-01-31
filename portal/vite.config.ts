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
      host: 'congenial-carnival-jjp4759q4r7cprqg-5173.app.github.dev',
      port: 443,
      path: '/ws'
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
