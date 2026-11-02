import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Cross-origin isolation lets WASM engines (ffmpeg, Whisper) use threads.
// `credentialless` keeps public CDN downloads (models, language data) working.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Ondevo — tools that run on your device',
        short_name: 'Ondevo',
        description: 'Audio and document tools that run on your own device. Nothing is uploaded.',
        theme_color: '#1f2b4d',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache only the app itself (about 1.5 MB). Engines are cached on first use instead.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/*.png'],
        globIgnores: ['**/*.worker-*.js', '**/rnnoise-*.js', '**/pdf.worker*', '**/transformers*', '**/ort-*', '**/jszip*'],
        maximumFileSizeToCacheInBytes: 700 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ondevo-assets', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            // Engines, language data and models from public CDNs: download once, keep.
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|huggingface\.co|cdn-lfs\.huggingface\.co|.*\.hf\.co|tessdata\.projectnaptha\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ondevo-engines',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@huggingface/transformers'] },
  server: { headers: isolation, proxy: { '/api': 'http://localhost:8080' } },
  preview: { headers: isolation },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
} as any);
