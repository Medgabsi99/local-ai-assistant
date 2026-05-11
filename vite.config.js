import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'offline.html'],
      manifest: {
        name: 'Local AI Assistant',
        short_name: 'LocalAI',
        description: 'Privacy-first AI assistant running entirely in your browser',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // onnxruntime-web v1.14.0 has no true ESM build — all builds are UMD.
      // Point to the ES6 UMD variant so Vite's dep-optimizer can wrap it into
      // a proper ESM module (CJS→ESM transform). Without this alias Vite serves
      // the raw UMD file which breaks in strict-mode ES module workers because
      // `this` is undefined and the global `ort` object is never registered.
      'onnxruntime-web': 'onnxruntime-web/dist/ort-web.es6.min.js',
    },
  },
  optimizeDeps: {
    // Keep transformers.js itself out of pre-bundling (has WASM side-effects)
    exclude: ['@xenova/transformers'],
    // But DO pre-bundle onnxruntime-web so Vite converts UMD → ESM wrapper
    include: ['onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
});
