// Build dos geradores de relatório para o servidor Node (rotinas automáticas de envio).
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  build: {
    ssr: 'src/lib/report/server-entry.js',
    outDir: 'dist-server',
    emptyOutDir: true,
    rollupOptions: { output: { format: 'es', entryFileNames: 'reports.mjs' } },
  },
});
