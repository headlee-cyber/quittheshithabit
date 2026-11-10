import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages では https://<user>.github.io/quittheshithabit/ で配信される
export default defineConfig({
  base: '/quittheshithabit/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'マクロ管理 - 筋トレ食事記録',
        short_name: 'マクロ管理',
        description: '筋トレ向けのPFC・カロリー・体重管理アプリ',
        lang: 'ja',
        display: 'standalone',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
});
