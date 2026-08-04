import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA je záměrně nastavená hned ve Fázi 0: cílem je ověřit, že prázdná appka
// jde nainstalovat na plochu telefonu a otevře se offline (SPEC, Fáze 0).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Osobní kuchařka',
        short_name: 'Kuchařka',
        description:
          'Osobní sbírka receptů, která umí i počítat kalorie. Rychlé zachycení, offline.',
        lang: 'cs',
        // Relativní, aby appka fungovala i na podadrese (GitHub Pages) i v kořeni.
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#b45309',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell se předcachuje → aplikace naběhne i úplně offline (NF-3).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
