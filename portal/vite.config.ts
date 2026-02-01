import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/portal/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webp,json,ico,txt}'],
      },
    }),
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
