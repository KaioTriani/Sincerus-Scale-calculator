// Envio pelo WhatsApp oficial via ViaZapi (Chatwoot): https://chat.viazapi.tech/api/v1/...
// Regra da Meta: mensagem livre (texto/arquivo) só entra se o contato escreveu nas últimas 24h.
// Fora da janela, usa um modelo aprovado (WA_TEMPLATE_REPORT com PDF no cabeçalho, WA_TEMPLATE_ALERT só texto).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './paths.mjs';

const env = (k, d = '') => process.env[k] || d;
export const whatsappConfigured = () => !!(env('VIAZAPI_TOKEN') && env('VIAZAPI_BASE_URL'));
const ACCOUNT = () => env('VIAZAPI_ACCOUNT_ID', '1');
const INBOX = () => Number(env('VIAZAPI_INBOX_ID', '4'));
export const recipients = () => env('REPORT_PHONES').split(',').map((p) => p.trim()).filter(Boolean);

async function cw(p, { method = 'GET', json, form } = {}) {
  const res = await fetch(`${env('VIAZAPI_BASE_URL')}/api/v1${p}`, {
    method,
    headers: { api_access_token: env('VIAZAPI_TOKEN'), ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : form,
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`Chatwoot ${method} ${p}: ${res.status} ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// ---------- arquivos públicos temporários (o modelo da Meta precisa de um link para o PDF) ----------
const FILES = path.join(DATA_DIR, 'files');
export function publishFile(buffer, fileName) {
  fs.mkdirSync(FILES, { recursive: true });
  const id = crypto.randomBytes(16).toString('hex');
  const safe = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
  const name = `${id}__${safe}`;
  fs.writeFileSync(path.join(FILES, name), buffer);
  // limpa arquivos com mais de 15 dias
  for (const f of fs.readdirSync(FILES)) { const full = path.join(FILES, f); if (Date.now() - fs.statSync(full).mtimeMs > 15 * 86400000) fs.rmSync(full, { force: true }); }
  const base = env('PUBLIC_URL').replace(/\/$/, '');
  return { name, url: base ? `${base}/files/${name}` : null };
}
export function servePublicFile(req, res, url) {
  const name = decodeURIComponent(url.pathname.slice('/files/'.length));
  if (!/^[a-f0-9]{32}__[A-Za-z0-9._-]+$/.test(name)) { res.writeHead(404); return res.end(); }
  const full = path.join(FILES, name);
  if (!fs.existsSync(full)) { res.writeHead(404); return res.end('Arquivo expirado'); }
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name.split('__')[1]}"`, 'Cache-Control': 'private, max-age=0', 'X-Robots-Tag': 'noindex' });
  fs.createReadStream(full).pipe(res);
}

// ---------- contato, conversa e janela de 24h ----------
const digits = (p) => p.replace(/\D/g, '');
async function contactFor(phone) {
  const found = await cw(`/accounts/${ACCOUNT()}/contacts/search?q=${digits(phone)}`);
  const c = (found.payload || []).find((x) => digits(x.phone_number || '') === digits(phone));
  if (c) return c.id;
  const created = await cw(`/accounts/${ACCOUNT()}/contacts`, { method: 'POST', json: { inbox_id: INBOX(), name: phone, phone_number: `+${digits(phone)}` } });
  return created.payload?.contact?.id ?? created.id;
}
async function conversationFor(phone) {
  const contactId = await contactFor(phone);
  const list = await cw(`/accounts/${ACCOUNT()}/contacts/${contactId}/conversations`);
  const conv = (list.payload || []).filter((c) => c.inbox_id === INBOX()).sort((a, b) => b.last_activity_at - a.last_activity_at)[0];
  if (conv) return conv.id;
  const contact = await cw(`/accounts/${ACCOUNT()}/contacts/${contactId}`);
  const sourceId = (contact.payload?.contact_inboxes || contact.contact_inboxes || []).find((ci) => ci.inbox?.id === INBOX())?.source_id || digits(phone);
  const created = await cw(`/accounts/${ACCOUNT()}/conversations`, { method: 'POST', json: { source_id: sourceId, inbox_id: INBOX(), contact_id: contactId } });
  return created.id;
}
async function windowOpen(convId) {
  const m = await cw(`/accounts/${ACCOUNT()}/conversations/${convId}/messages`);
  const lastIn = (m.payload || []).filter((x) => x.message_type === 0).reduce((t, x) => Math.max(t, x.created_at || 0), 0);
  return lastIn > 0 && Date.now() / 1000 - lastIn < 23.5 * 3600;
}

// ---------- defesas de envio ----------
// 1) Confere a entrega: depois de enviar, acompanha o status da mensagem no Chatwoot (até ~40 s).
// 2) Limite da Meta (131049, mensagens de Marketing por pessoa): ao detectar, para de mandar para aquele número
//    por 24 h e guarda o que seria enviado numa fila — nada de mensagens "Falha ao enviar" em sequência.
// 3) A fila é reenviada quando o bloqueio passa (avisos de texto viram uma mensagem só; PDFs vão um a um).
const GUARD = path.join(DATA_DIR, 'wa-guard.json');
const readGuard = () => { try { return JSON.parse(fs.readFileSync(GUARD, 'utf8')); } catch { return { blocked: {}, queue: [] }; } };
const writeGuard = (g) => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(GUARD, JSON.stringify(g, null, 1)); };
const CAP_CODES = ['131049', '131048', '131056']; // engajamento/limite de envio/spam de par: esperar resolve
export class Deferred extends Error { constructor(msg) { super(msg); this.deferred = true; } }

export function guardStatus() {
  const g = readGuard();
  const now = Date.now();
  return { blocked: Object.fromEntries(Object.entries(g.blocked || {}).filter(([, b]) => b.until > now)), queued: (g.queue || []).length };
}
function blockedUntil(phone) { const b = readGuard().blocked?.[digits(phone)]; return b && b.until > Date.now() ? b : null; }
function block(phone, reason, hours = 24) { const g = readGuard(); g.blocked = { ...(g.blocked || {}), [digits(phone)]: { until: Date.now() + hours * 3600000, reason, at: new Date().toISOString() } }; writeGuard(g); }
function enqueue(item) {
  const g = readGuard();
  g.queue = [...(g.queue || []).filter((q) => Date.now() - Date.parse(q.at) < 7 * 86400000), { ...item, at: new Date().toISOString() }].slice(-60);
  writeGuard(g);
}
// bloqueio também a partir do histórico do Chatwoot (vale mesmo se o arquivo de controle se perder)
async function capFromHistory(conv) {
  const m = await cw(`/accounts/${ACCOUNT()}/conversations/${conv}/messages`);
  const fail = (m.payload || []).filter((x) => x.message_type === 1 && x.status === 'failed' && CAP_CODES.some((c) => String(x.content_attributes?.external_error || '').startsWith(c)))
    .sort((a, b) => b.created_at - a.created_at)[0];
  if (fail && Date.now() / 1000 - fail.created_at < 24 * 3600) return { until: (fail.created_at + 24 * 3600) * 1000, reason: String(fail.content_attributes.external_error).slice(0, 80) };
  return null;
}
// acompanha o status até sair de "sent" (entregue/lido = ok; falhou = erro com o código da Meta)
async function confirm(conv, id, waitMs = 40000) {
  if (!id) return { status: 'desconhecido' };
  const t0 = Date.now();
  while (Date.now() - t0 < waitMs) {
    await new Promise((r) => setTimeout(r, 5000));
    const m = await cw(`/accounts/${ACCOUNT()}/conversations/${conv}/messages`).catch(() => null);
    const msg = (m?.payload || []).find((x) => x.id === id);
    if (!msg) continue;
    if (msg.status === 'failed') return { status: 'failed', error: String(msg.content_attributes?.external_error || 'falha sem detalhe') };
    if (msg.status === 'delivered' || msg.status === 'read') return { status: msg.status };
  }
  return { status: 'sent' }; // aceito pela Meta, sem confirmação de entrega ainda
}
async function post(conv, payload) {
  const r = await cw(`/accounts/${ACCOUNT()}/conversations/${conv}/messages`, payload);
  return r?.id;
}
// envia (ou adia) e confere; item = como reenviar depois, se for adiado
async function deliver(phone, conv, payload, item) {
  const held = blockedUntil(phone) || (await capFromHistory(conv));
  if (held) {
    if (!blockedUntil(phone)) block(phone, held.reason, Math.max(1, (held.until - Date.now()) / 3600000));
    if (item?.type !== 'noop') enqueue({ phone, ...item });
    throw new Deferred(`adiado: Meta limitou mensagens para este número até ${new Date(held.until).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  }
  const id = await post(conv, payload);
  const st = await confirm(conv, id);
  if (st.status === 'failed') {
    if (CAP_CODES.some((c) => st.error.startsWith(c))) { block(phone, st.error.slice(0, 80)); if (item?.type !== 'noop') enqueue({ phone, ...item }); throw new Deferred(`adiado após limite da Meta: ${st.error.slice(0, 60)}`); }
    throw new Error(`Meta recusou: ${st.error.slice(0, 120)}`);
  }
  return st.status;
}

// ---------- envio ----------
// texto: mensagem livre; fora da janela, modelo aprovado (a Meta não aceita quebra de linha em parâmetros):
//  - modelos diario_sincerus_1…10: "Diário Sincerus - Resumo ({{1}})" + "Informações importantes" + uma linha por aviso
//  - WA_TEMPLATE_DIGEST=off volta ao modelo antigo (WA_TEMPLATE_ALERT, {{1}} = resumo numa linha)
// categoria de cada modelo como a Meta aprovou (Utilidade não tem o limite diário por pessoa do Marketing)
let tplCache = { at: 0, map: {} };
async function templateCategories() {
  if (Date.now() - tplCache.at < 10 * 60000) return tplCache.map;
  try {
    const ib = await cw(`/accounts/${ACCOUNT()}/inboxes/${INBOX()}`);
    const map = Object.fromEntries((ib.message_templates || []).filter((t) => t.status === 'APPROVED').map((t) => [t.name, t.category]));
    tplCache = { at: Date.now(), map };
  } catch { /* usa o que tiver */ }
  return tplCache.map;
}
// divide N linhas em mensagens usando os tamanhos de modelo disponíveis, preferindo os de Utilidade
// ex.: Utilidade com 1, 2 e 4 linhas → 9 linhas = 4 + 4 + 1 (3 mensagens sem limite)
export function planChunks(n, utilSizes, maxMsgs = 4) {
  const sizes = [...utilSizes].sort((a, b) => b - a);
  if (!sizes.length || !n) return null;
  const out = [];
  let left = n;
  while (left > 0 && out.length < maxMsgs) { const k = sizes.find((x) => x <= left) ?? sizes[sizes.length - 1]; out.push(Math.min(k, left)); left -= Math.min(k, left); }
  return left > 0 ? { chunks: out, overflow: left } : { chunks: out, overflow: 0 };
}
const oneLine = (s, max = 1000) => String(s).replace(/\s*\n+\s*/g, ' · ').replace(/\s{2,}/g, ' ').slice(0, max);
export async function sendText(phone, text, opts = {}) {
  const { templateBody, digest } = opts;
  const conv = await conversationFor(phone);
  const item = { type: 'text', text, opts };
  if (await windowOpen(conv)) return `texto:${await deliver(phone, conv, { method: 'POST', json: { content: text, message_type: 'outgoing' } }, item)}`;
  const digestName = env('WA_TEMPLATE_DIGEST', 'diario_sincerus');
  const useDigest = digest && digestName !== 'off';
  const cats = await templateCategories();
  // com modelos de Utilidade disponíveis: várias mensagens curtas de Utilidade em vez de uma de Marketing
  if (useDigest && digest.lines.length) {
    const util = Array.from({ length: 10 }, (_, i) => i + 1).filter((k) => cats[`${digestName}_${k}`] === 'UTILITY');
    const plan = planChunks(digest.lines.length, util);
    if (plan) {
      const lines = digest.lines.map((l) => oneLine(l, 200));
      const vias = [];
      let pos = 0;
      for (let i = 0; i < plan.chunks.length; i++) {
        let part = lines.slice(pos, pos + plan.chunks[i]);
        pos += plan.chunks[i];
        if (i === plan.chunks.length - 1 && plan.overflow) part = [...part.slice(0, -1), `E mais ${plan.overflow + 1} aviso(s) — lista completa na plataforma`];
        const tag = plan.chunks.length > 1 ? ` (${i + 1}/${plan.chunks.length})` : '';
        const name = `${digestName}_${part.length}`;
        const payload = { method: 'POST', json: { content: part.join(' · '), message_type: 'outgoing', template_params: { name, category: cats[name] || 'UTILITY', language: env('WA_TEMPLATE_ALERT_LANG', 'pt_BR'), processed_params: { body: { 1: oneLine(`${digest.type}${tag}`, 60), ...Object.fromEntries(part.map((l, j) => [j + 2, l])) } } } } };
        // adiamento só faz sentido para a mensagem inteira: se a primeira parte for adiada, o resto vai junto pela fila
        vias.push(await deliver(phone, conv, payload, i === 0 ? item : { type: 'noop' }));
      }
      return `utilidade:${vias.join(',')}`;
    }
  }
  let tpl, body;
  if (useDigest) {
    const MAX = 10;
    let list = digest.lines.length ? digest.lines.map((l) => oneLine(l, 200)) : ['✅ Nenhum problema nas contas'];
    if (list.length > MAX) list = [...list.slice(0, MAX - 1), `E mais ${list.length - (MAX - 1)} aviso(s) — lista completa na plataforma`];
    tpl = `${digestName}_${list.length}`;
    body = { 1: oneLine(digest.type, 60), ...Object.fromEntries(list.map((l, i) => [i + 2, l])) };
  } else {
    tpl = env('WA_TEMPLATE_ALERT');
    body = { 1: oneLine(templateBody || text) };
  }
  if (!tpl) throw new Error('janela de 24h fechada e WA_TEMPLATE_ALERT não configurado');
  const payload = { method: 'POST', json: { content: useDigest ? text : oneLine(text), message_type: 'outgoing', template_params: { name: tpl, category: cats[tpl] || 'MARKETING', language: env('WA_TEMPLATE_ALERT_LANG', 'pt_BR'), processed_params: { body } } } };
  return `modelo:${await deliver(phone, conv, payload, item)}`;
}

// documento: anexo livre; fora da janela, modelo com o PDF no cabeçalho (link público) e corpo {{1}} nome, {{2}} relatório, {{3}} período
export async function sendDocument(phone, buffer, fileName, caption, info = {}) {
  const { name = '', title = '', period = '' } = info;
  const conv = await conversationFor(phone);
  const stored = publishFile(buffer, fileName); // também serve para reenviar depois, se for adiado
  const item = { type: 'doc', stored: stored.name, fileName, caption, info };
  if (await windowOpen(conv)) {
    const form = new FormData();
    form.append('content', caption);
    form.append('message_type', 'outgoing');
    form.append('attachments[]', new Blob([buffer], { type: 'application/pdf' }), fileName);
    return `arquivo:${await deliver(phone, conv, { method: 'POST', form }, item)}`;
  }
  // modelo do PDF: documento_sincerus quando aprovado como Utilidade (sem limite diário); senão o relatorio_sincerus
  const cats = await templateCategories();
  const docTpl = env('WA_TEMPLATE_DOC', 'documento_sincerus');
  const useDoc = cats[docTpl] === 'UTILITY' || (cats[docTpl] && !cats[env('WA_TEMPLATE_REPORT')]);
  const tpl = useDoc ? docTpl : env('WA_TEMPLATE_REPORT');
  if (!tpl) throw new Error('janela de 24h fechada e WA_TEMPLATE_REPORT não configurado');
  if (!stored.url) throw new Error('PUBLIC_URL não configurado (o modelo precisa de um link público para o PDF)');
  const payload = { method: 'POST', json: { content: caption, message_type: 'outgoing', template_params: { name: tpl, category: cats[tpl] || 'MARKETING', language: env('WA_TEMPLATE_REPORT_LANG', 'pt_BR'), processed_params: { body: useDoc ? { 1: title.replace(/^(o |a )/, ''), 2: period } : { 1: name || 'equipe', 2: title, 3: period }, header: { media_url: stored.url, media_type: 'document' } } } } };
  return `modelo:${await deliver(phone, conv, payload, item)}`;
}

// manda para todos os destinatários configurados; devolve o resultado de cada um (adiado = vai pela fila)
export async function broadcast(fn) {
  const out = [];
  for (const phone of recipients()) {
    try { out.push({ phone, ok: true, via: await fn(phone) }); } catch (e) { out.push({ phone, ok: false, deferred: !!e.deferred || undefined, error: e.message }); }
  }
  return out;
}

// reenvia o que ficou na fila para números já liberados (avisos de texto juntos numa mensagem; PDFs um a um)
export async function flushQueue() {
  const g = readGuard();
  const queue = g.queue || [];
  if (!queue.length) return { sent: 0, left: 0 };
  const ready = queue.filter((q) => !blockedUntil(q.phone));
  if (!ready.length) return { sent: 0, left: queue.length };
  writeGuard({ ...g, queue: queue.filter((q) => blockedUntil(q.phone)) }); // tira da fila antes; o que for adiado de novo volta
  let sent = 0;
  const byPhone = Object.groupBy ? Object.groupBy(ready, (q) => q.phone) : ready.reduce((m, q) => ((m[q.phone] ||= []).push(q), m), {});
  for (const [phone, items] of Object.entries(byPhone)) {
    const texts = items.filter((q) => q.type === 'text');
    if (texts.length) {
      const lines = [...new Set(texts.flatMap((q) => q.opts?.digest?.lines || [oneLine(q.text, 200)]))];
      const day = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
      const text = `*Diário Sincerus - Resumo (Avisos pendentes · ${day})*\n\n*Informações importantes*\n\n${lines.join('\n')}`;
      try { await sendText(phone, text, { digest: { type: `Avisos pendentes · ${day}`, lines } }); sent++; } catch { /* volta para a fila se adiado */ }
    }
    for (const q of items.filter((x) => x.type === 'doc')) {
      const file = path.join(FILES, q.stored);
      if (!fs.existsSync(file)) continue;
      try { await sendDocument(phone, fs.readFileSync(file), q.fileName, q.caption, q.info); sent++; } catch { /* idem */ }
    }
  }
  return { sent, left: (readGuard().queue || []).length };
}

// acesso ao Chatwoot para a verificação de saúde (health.mjs)
export const chatwoot = (p, o) => cw(p, o);
export const inboxPath = () => `/accounts/${ACCOUNT()}/inboxes/${INBOX()}`;
export const accountPath = () => `/accounts/${ACCOUNT()}`;
