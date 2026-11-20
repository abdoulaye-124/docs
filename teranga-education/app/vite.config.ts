import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// En développement, /auth/v1, /rest/v1 et /functions/v1 sont relayés vers la
// passerelle locale (dev/local-stack.sh), comme sur un projet Supabase hébergé.
const passerelle = process.env.TERANGA_GATEWAY ?? 'http://localhost:54321';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'TERANGA ÉDUCATION',
        short_name: 'Teranga',
        description: "Centre d'accompagnement, de remédiation et de réussite scolaire (CI-CM2)",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#065f46',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Phase 2 : on ne met en cache que l'application elle-même.
        // Les données (API) ne sont jamais mises en cache par le Service Worker.
        navigateFallbackDenylist: [/^\/(auth|rest|functions)\//],
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy: {
      '/auth/v1': passerelle,
      '/rest/v1': passerelle,
      '/functions/v1': passerelle,
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: {
      '/auth/v1': passerelle,
      '/rest/v1': passerelle,
      '/functions/v1': passerelle,
    },
  },
  test: {
    include: ['src/**/*.test.ts', '../shared/**/*.test.ts'],
  },
});
