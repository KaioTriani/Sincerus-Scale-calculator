// Pasta de dados do servidor (o que já foi enviado, PDFs temporários, Chromium descompactado).
// Em produção fica FORA da pasta do app (na home do usuário da Hostinger), porque cada
// reimplantação substitui a pasta do app — e com ela se perderia o registro do que já foi enviado.
// DATA_DIR (variável de ambiente) tem prioridade. Em desenvolvimento usa server/data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL = path.resolve(fileURLToPath(new URL('./data', import.meta.url)));

function pick() {
  const candidates = [process.env.DATA_DIR, process.env.NODE_ENV === 'production' ? path.join(os.homedir(), '.sincerus-scale') : null].filter(Boolean);
  for (const dir of candidates) {
    try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); return dir; } catch { /* tenta a próxima */ }
  }
  return LOCAL;
}

export const DATA_DIR = pick();
fs.mkdirSync(DATA_DIR, { recursive: true });
// leva o estado antigo (de server/data) para a pasta nova, uma vez
try {
  const from = path.join(LOCAL, 'state.json'), to = path.join(DATA_DIR, 'state.json');
  if (DATA_DIR !== LOCAL && !fs.existsSync(to) && fs.existsSync(from)) fs.copyFileSync(from, to);
} catch { /* sem estado antigo */ }
