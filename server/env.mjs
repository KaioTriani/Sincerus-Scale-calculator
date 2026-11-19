// Carrega o .env local, se existir. Na Hostinger, as variáveis vêm do painel e este arquivo não existe.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const file = fileURLToPath(new URL('../.env', import.meta.url));
if (fs.existsSync(file)) process.loadEnvFile(file);

// Na Hostinger o processo roda sem uma entrada padrão válida: ler process.stdin dá "open EEXIST".
// Bibliotecas que importam 'process' (ex.: puppeteer) leem todos os campos e quebram. Troca por uma entrada vazia.
try { void process.stdin; } catch {
  const empty = new Readable({ read() { this.push(null); } });
  Object.defineProperty(process, 'stdin', { value: empty, configurable: true, writable: true, enumerable: true });
  console.log('Aviso: entrada padrão indisponível; substituída por uma vazia.');
}
