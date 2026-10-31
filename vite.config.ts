import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: false,
      workbox: {
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // La RVR1960 (≈4,6 MB) no va en el precaché: se cachea al abrir la Biblia
        // por primera vez. Offline funciona desde ese primer uso con conexión.
        globIgnores: ['**/bible-rvr1960-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/bible-rvr1960-[\w-]+\.js$/,
            handler: 'CacheFirst',
            // El nombre lleva hash: cada versión nueva es otra entrada; 2 deja la vieja salir.
            options: { cacheName: 'bible-cache', expiration: { maxEntries: 2 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Unit tests live in src/; tests/ holds Playwright E2E specs (run via `pnpm test:e2e`)
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  }
})
