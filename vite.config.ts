import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync } from 'node:fs';

// Rotas do app (React Router). Cada uma ganha uma cópia do index.html no build,
// para abrir direto pelo endereço mesmo em hospedagem estática, sem regra de reescrita.
const APP_ROUTES = ['login', 'recuperar', 'dashboard', 'clientes', 'relatorios'];

function routeCopies(): Plugin {
  return {
    name: 'sincerus-route-copies',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist/', import.meta.url));
      for (const r of APP_ROUTES) {
        mkdirSync(`${dist}${r}`, { recursive: true });
        copyFileSync(`${dist}index.html`, `${dist}${r}/index.html`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), routeCopies()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // Em desenvolvimento, /api vai para o servidor local (npm start na porta 3000)
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:3000' } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        calculadora: fileURLToPath(new URL('./calculadora/index.html', import.meta.url)),
        roleta: fileURLToPath(new URL('./roleta/index.html', import.meta.url)),
      },
    },
  },
});
