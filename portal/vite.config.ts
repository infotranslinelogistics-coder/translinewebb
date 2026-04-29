import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const portalNodeModules = path.resolve(__dirname, 'node_modules')

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
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(portalNodeModules, 'react'),
      'react/jsx-runtime': path.resolve(portalNodeModules, 'react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(portalNodeModules, 'react/jsx-dev-runtime.js'),
      'react-dom': path.resolve(portalNodeModules, 'react-dom'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
})
