import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// vite-plugin-pwa は全ページにマクロ管理の manifest を挿入するため、
// 独自の manifest を持つ /todo/ からは取り除く
const todoOwnManifest: Plugin = {
  name: 'todo-own-manifest',
  enforce: 'post',
  generateBundle(_, bundle) {
    const page = bundle['todo/index.html'];
    if (page?.type === 'asset' && typeof page.source === 'string') {
      page.source = page.source.replace(/\s*<link rel="manifest" href="[^"]*\/manifest\.webmanifest"[^>]*>/, '');
    }
  },
};

// GitHub Pages では https://<user>.github.io/quittheshithabit/ で配信される
export default defineConfig({
  base: '/quittheshithabit/',
  build: {
    rollupOptions: {
      // index.html = マクロ管理、todo/index.html = 音声 To Do
      input: { main: 'index.html', todo: 'todo/index.html' },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // /todo/ は別アプリなので、マクロ管理の index.html にフォールバックさせない
      workbox: { navigateFallbackDenylist: [/\/todo\//] },
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
    todoOwnManifest,
  ],
});
