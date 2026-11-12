// Servidor de produção: entrega o build (dist) e a API (login + Meta).
// Sem dependências externas. Inicie com `npm start` depois de `npm run build`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { login, logout, readSession, users } from './auth.mjs';
import * as meta from './meta.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));
// A hospedagem informa a porta em PORT (pode ser número ou caminho de socket); localmente, 3000
const PORT = process.env.PORT || 3000;
const built = () => fs.existsSync(path.join(ROOT, 'index.html'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 1e5) throw new Error('Corpo muito grande'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}

async function api(req, res, url) {
  const send = (s, d) => json(res, s, d);
  const route = `${req.method} ${url.pathname}`;
  try {
    if (route === 'POST /api/auth/login') return login(req, res, await readBody(req), send);
    if (route === 'POST /api/auth/logout') return logout(req, res, send);
    const user = readSession(req);
    if (route === 'GET /api/auth/me') return user ? send(200, user) : send(401, { error: 'Sessão expirada.' });
    if (!user) return send(401, { error: 'Faça login.' });

    const q = (k) => url.searchParams.get(k) || '';
    const refresh = q('refresh') === '1';
    if (route === 'GET /api/meta/status') return send(200, { configured: meta.configured(), version: process.env.META_API_VERSION || 'v23.0' });
    if (route === 'GET /api/meta/accounts') return send(200, await meta.accounts(refresh));
    if (route === 'GET /api/meta/report') return send(200, await meta.report(q('account'), q('since'), q('until'), refresh));
    if (route === 'GET /api/meta/active-ads') return send(200, await meta.activeAds(refresh));
    if (route === 'GET /api/meta/overview') return send(200, await meta.overview(q('since'), q('until'), refresh));
    return send(404, { error: 'Rota não encontrada.' });
  } catch (e) {
    console.error(route, e.message);
    return send(e.status || 500, { error: e.message || 'Erro interno.' });
  }
}

function serveStatic(req, res, url) {
  if (!built()) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Build não encontrado: rode "npm run build" antes de iniciar o servidor.');
  }
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    if (path.extname(p)) { res.writeHead(404); return res.end('Não encontrado'); }
    file = path.join(ROOT, 'index.html'); // rotas do app (login, dashboard…)
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url);
}).listen(PORT, () => {
  console.log(`Sincerus Scale na porta ${PORT} · Meta API ${meta.configured() ? 'configurada' : 'NÃO configurada'}`);
  // Avisos de configuração no log da hospedagem (o site público funciona mesmo assim)
  if (!built()) console.warn('AVISO: pasta dist/ não encontrada. Rode "npm run build".');
  if ((process.env.SESSION_SECRET || '').length < 32) console.warn('AVISO: SESSION_SECRET ausente ou curto: o login não vai funcionar.');
  if (!users().length) console.warn('AVISO: AUTH_USERS vazio ou inválido: ninguém consegue entrar.');
});
