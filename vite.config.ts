/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base: works on GitHub Pages (/physics-lab/) and locally, because routing uses the URL hash.
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Physics Lab',
        short_name: 'Physics Lab',
        description: 'Interactive physics simulations for IB Physics HL and a mobile sensor lab',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  test: {
    include: ['tests/physics/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    // some physics checks integrate hundreds of thousands of steps; CI machines are slower
    testTimeout: 60_000,
  },
});
