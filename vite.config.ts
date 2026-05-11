import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/imdel-maps/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'leaflet.markercluster'],
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: process.env.VITE_APP_NAME || 'Maps',
        short_name: process.env.VITE_APP_SHORT_NAME || 'Maps',
        description: process.env.VITE_APP_DESCRIPTION || 'Interactive cooperative map',
        start_url: process.env.VITE_BASE_PATH || '/imdel-maps/',
        display: 'standalone',
        background_color: process.env.VITE_PWA_BACKGROUND_COLOR || '#ffffff',
        theme_color: process.env.VITE_PWA_THEME_COLOR || '#26336b',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/light_all\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-tiles',
              expiration: { maxEntries: 700, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
