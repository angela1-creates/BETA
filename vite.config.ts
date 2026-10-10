import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/BETA/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/beta-icon.svg'],
    manifest: {
      name: 'BETA — Climb together', short_name: 'BETA', description: 'Climb together. Share your beta. Keep the crew going.',
      theme_color: '#20332c', background_color: '#f5f3ee', display: 'standalone', start_url: '/BETA/', scope: '/BETA/',
      icons: [{ src: '/BETA/icons/beta-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    },
    workbox: { navigateFallback: '/BETA/index.html', maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp}'] }
  })]
})
