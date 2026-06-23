import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Cursor VM / スマホプレビュー用の動的ホスト名を許可
    allowedHosts: true,
  },
});
