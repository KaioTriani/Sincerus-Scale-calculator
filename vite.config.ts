import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), roleta: fileURLToPath(new URL('./roleta/index.html', import.meta.url)) } } },
});
