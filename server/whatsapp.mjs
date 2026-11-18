// Envio pelo WhatsApp oficial via ViaZapi (Chatwoot): https://chat.viazapi.tech/api/v1/...
// Regra da Meta: mensagem livre (texto/arquivo) só entra se o contato escreveu nas últimas 24h.
// Fora da janela, usa um modelo aprovado (WA_TEMPLATE_REPORT com PDF no cabeçalho, WA_TEMPLATE_ALERT só texto).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
const FILES = path.resolve(fileURLToPath(new URL('./data/files', import.meta.url)));
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

// ---------- envio ----------
// texto: mensagem livre; fora da janela, modelo de alerta com o texto numa linha (a Meta não aceita quebra de linha em parâmetros)
export async function sendText(phone, text, { templateBody } = {}) {
  const conv = await conversationFor(phone);
  if (await windowOpen(conv)) {
    await cw(`/accounts/${ACCOUNT()}/conversations/${conv}/messages`, { method: 'POST', json: { content: text, message_type: 'outgoing' } });
    return 'texto';
  }
  const tpl = env('WA_TEMPLATE_ALERT');
  if (!tpl) throw new Error('janela de 24h fechada e WA_TEMPLATE_ALERT não configurado');
  const oneLine = (s) => String(s).replace(/\s*\n+\s*/g, ' · ').replace(/\s{2,}/g, ' ').slice(0, 1000);
  await cw(`/accounts/${ACCOUNT()}/conversations/${conv}/messages`, {
    method: 'POST',
    json: { content: oneLine(text), message_type: 'outgoing', template_params: { name: tpl, category: 'UTILITY', language: env('WA_TEMPLATE_ALERT_LANG', 'pt_BR'), processed_params: { body: { 1: oneLine(templateBody || text) } } } },
  });
  return 'modelo';
}

// documento: anexo livre; fora da janela, modelo com o PDF no cabeçalho (link público) e corpo {{1}} nome, {{2}} relatório, {{3}} período
export async function sendDocument(phone, buffer, fileName, caption, { name = '', title = '', period = '' } = {}) {
  const conv = await conversationFor(phone);
  if (await windowOpen(conv)) {
    const form = new FormData();
    form.append('content', caption);
    form.append('message_type', 'outgoing');
    form.append('attachments[]', new Blob([buffer], { type: 'application/pdf' }), fileName);
    await cw(`/accounts/${ACCOUNT()}/conversations/${conv}/messages`, { method: 'POST', form });
    return 'arquivo';
  }
  const tpl = env('WA_TEMPLATE_REPORT');
  if (!tpl) throw new Error('janela de 24h fechada e WA_TEMPLATE_REPORT não configurado');
  const { url } = publishFile(buffer, fileName);
  if (!url) throw new Error('PUBLIC_URL não configurado (o modelo precisa de um link público para o PDF)');
  await cw(`/accounts/${ACCOUNT()}/conversations/${conv}/messages`, {
    method: 'POST',
    json: { content: caption, message_type: 'outgoing', template_params: { name: tpl, category: 'UTILITY', language: env('WA_TEMPLATE_REPORT_LANG', 'pt_BR'), processed_params: { body: { 1: name || 'equipe', 2: title, 3: period }, header: { media_url: url, media_type: 'document' } } } },
  });
  return 'modelo';
}

// manda para todos os destinatários configurados; devolve o resultado de cada um
export async function broadcast(fn) {
  const out = [];
  for (const phone of recipients()) {
    try { out.push({ phone, ok: true, via: await fn(phone) }); } catch (e) { out.push({ phone, ok: false, error: e.message }); }
  }
  return out;
}
