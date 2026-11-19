// Rotinas automáticas (horário de Brasília):
//  - weekly:  toda segunda às 8h — relatório para cliente (últimos 7 dias × 7 dias anteriores) + anúncios ativos
//  - monthly: todo dia 1º às 8h — relatório interno de desempenho do mês anterior, todos os clientes
//  - daily:   todo dia às 8h — resumo de saldos e de todos os alertas abertos
//  - alerts:  a cada 30 min (7h–23h) — só os alertas NOVOS (saldo, anúncio com erro/reprovado, duplicado, baixo alcance, frequência)
// Envio pelo WhatsApp (ViaZapi/Chatwoot) para REPORT_PHONES. Estado (o que já foi enviado) em DATA_DIR/state.json (fora da pasta do app em produção, ver paths.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as meta from './meta.mjs';
import { htmlToPdf } from './pdf.mjs';
import { whatsappConfigured, recipients, sendText, sendDocument, broadcast } from './whatsapp.mjs';
import { DATA_DIR } from './paths.mjs';

const DATA = DATA_DIR;
const STATE = path.join(DATA, 'state.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { alerts: {} }; } };
const writeState = (s) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 1)); };
const reports = () => import('../dist-server/reports.mjs');

// ---------- datas no fuso de Brasília ----------
const TZ = 'America/Sao_Paulo';
export function nowBR() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute), weekday: p.weekday };
}
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dm = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const isoWeek = (iso) => { const d = new Date(`${iso}T12:00:00Z`); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y = d.getUTCFullYear(); const w = 1 + Math.round((d - new Date(Date.UTC(y, 0, 4))) / 604800000); return `${y}-W${String(w).padStart(2, '0')}`; };

// ---------- clientes ----------
// fora dos envios: clientes que saíram e contas internas (REPORT_EXCLUDE: nomes ou IDs separados por vírgula)
const excluded = (a) => {
  const list = (process.env.REPORT_EXCLUDE ?? 'DS AUTOS,VIAZAPI,Zion,Kaio Triani').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.some((x) => a.id.toLowerCase() === x || a.name.toLowerCase().includes(x));
};
const friendly = (n) => String(n).replace(/^\s*(ca|ac)\s*-\s*/i, '').replace(/\s*-\s*dol\s*$/i, '').replace(/\s+dol\s*$/i, '').trim();
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

async function ptax(since, until) {
  const f = (iso) => { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y}`; };
  for (const s of [since, addDays(until, -10)]) {
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${f(s)}'&@dataFinalCotacao='${f(until)}'&$format=json&$select=cotacaoVenda`;
    try { const v = (await (await fetch(url, { signal: AbortSignal.timeout(20000) })).json()).value || []; if (v.length) { const rate = Math.round((v.reduce((t, x) => t + x.cotacaoVenda, 0) / v.length) * 10000) / 10000; return { rate, source: `PTAX de venda do Banco Central — média de ${v.length} cotações (${dm(s)} a ${dm(until)}).` }; } } catch { /* tenta de novo */ }
  }
  throw new Error('PTAX indisponível no Banco Central.');
}
const logo = () => `data:image/png;base64,${fs.readFileSync(fileURLToPath(new URL('../public/logo-report.png', import.meta.url))).toString('base64')}`;
const mergeHtml = (docs) => {
  if (docs.length === 1) return docs[0];
  const head = docs[0].match(/<head>([\s\S]*)<\/head>/)[1];
  return `<!doctype html><html lang="pt-BR"><head>${head}</head><body>${docs.map((d) => d.match(/<body>([\s\S]*)<\/body>/)[1]).join('\n')}</body></html>`;
};
async function sendPdf(html, fileName, caption, info, { dry } = {}) {
  const pdf = await htmlToPdf(html);
  if (dry) { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(path.join(DATA, `${fileName}.pdf`), pdf); return { dry: true, bytes: pdf.length, file: path.join(DATA, `${fileName}.pdf`) }; }
  return { bytes: pdf.length, sent: await broadcast((phone) => sendDocument(phone, pdf, `${fileName}.pdf`, caption, info)) };
}

// ---------- rotinas ----------
export async function weekly({ dry = false } = {}) {
  const { date } = nowBR();
  const since = addDays(date, -7), until = addDays(date, -1);
  const cmp = [addDays(since, -7), addDays(since, -1)];
  const R = await reports();
  const accs = (await meta.accounts(true)).filter((a) => !excluded(a) && a.statusCode !== 2 && a.statusCode !== 101);
  const needUsd = accs.some((a) => a.currency === 'USD');
  const fx = needUsd ? await ptax(since, until) : { rate: 1, source: '' };
  const list = (await pool(accs, 3, async (a) => {
    try {
      const data = await meta.clientReport(a.id, since, until, cmp[0], cmp[1], true);
      if (!data.campaigns.length) return null;
      const model = R.computeClientReport(data, { rate: fx.rate, rateSource: fx.source, ceiling: 6, responseRef: 0.01, freqLimit: 3, clientName: friendly(a.name), compareName: 'Semana anterior' });
      return { model, texts: R.draftTexts(model) };
    } catch (e) { console.error('weekly', a.name, e.message); return null; }
  })).filter(Boolean);
  const out = { period: [since, until], clients: list.map((x) => x.model.client) };
  if (list.length) {
    const { html } = R.buildClientReportsHtml(list);
    out.report = await sendPdf(html, `Relatorios_clientes_${dm(since).replace('/', '-')}_a_${dm(until).replace('/', '-')}`,
      `Relatórios para clientes · ${dm(since)} a ${dm(until)} · ${list.length} cliente(s)`, { name: 'equipe', title: `os relatórios para clientes (${list.length})`, period: `${dm(since)} a ${dm(until)}` }, { dry });
  }
  out.activeAds = await activeAds({ dry });
  return out;
}

export async function activeAds({ dry = false } = {}) {
  const R = await reports();
  const data = await meta.activeAds(true);
  const accs = data.accounts.filter((a) => a.campaigns.length && !excluded(a));
  if (!accs.length) return { clients: 0 };
  const when = new Date(data.fetchedAt);
  const { html, fileName } = R.buildActiveAdsHtml(accs, logo(), { when });
  const n = accs.reduce((t, a) => t + R.clientAdList(a).length, 0);
  return { clients: accs.length, ads: n, ...(await sendPdf(html, fileName, `Anúncios ativos · ${when.toLocaleDateString('pt-BR', { timeZone: TZ })} · ${accs.length} clientes, ${n} anúncios`, { name: 'equipe', title: 'a lista de anúncios ativos', period: when.toLocaleDateString('pt-BR', { timeZone: TZ }) }, { dry })) };
}

export async function monthly({ dry = false } = {}) {
  const { date } = nowBR();
  const [y, m] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  const R = await reports();
  const accs = (await meta.accounts(true)).filter((a) => !excluded(a) && a.statusCode !== 2 && a.statusCode !== 101);
  const fx = await ptax(first, last);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const docs = (await pool(accs, 3, async (a) => {
    try {
      const r = await meta.report(a.id, first, last, true);
      const campaigns = r.campaigns.filter((c) => c.ads.some((x) => x.spend > 0)).map((c) => ({
        ...c, key: uid(), label: '', printSpend: '', printImp: '', source: 'meta', filePeriods: [[first, last]], periodConfirmed: true,
        ads: c.ads.map((x) => ({ ...x, key: uid(), ...R.identifyCar(x.name) })),
      }));
      if (!campaigns.length) return null;
      const report = R.draftToReport({ client: a.name, clientId: a.id, periodStart: first, periodEnd: last, currency: a.currency, rate: String(fx.rate).replace('.', ','), rateSource: fx.source, campaigns });
      return R.buildReportHtml(report, R.compute(report), logo());
    } catch (e) { console.error('monthly', a.name, e.message); return null; }
  })).filter(Boolean);
  if (!docs.length) return { clients: 0 };
  const mes = new Date(Date.UTC(y, m - 2, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { clients: docs.length, ...(await sendPdf(mergeHtml(docs), `Relatorio_interno_${first.slice(0, 7)}`, `Relatório interno de desempenho · ${mes} · ${docs.length} clientes`, { name: 'equipe', title: 'o relatório interno do mês', period: mes }, { dry })) };
}

// coleta todos os alertas abertos agora (saldo/pagamento + saúde dos anúncios)
export async function collectAlerts() {
  const R = await reports();
  const bal = await meta.balances(true);
  const out = [];
  for (const a of bal.accounts) {
    if (excluded(a)) continue;
    const c = R.classifyBalance(a);
    if (c.level === 'crit' || c.level === 'warn') {
      const val = a.prepay ? ` (saldo ${a.currency === 'USD' ? 'US$' : 'R$'} ${(a.available ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';
      out.push({ key: `bal:${a.id}:${c.note}`, client: a.name, level: c.level, kind: 'saldo/pagamento', text: `${c.note}${val}`, info: `${c.note.split(' — ')[0]}${val.replace(' (saldo ', ' (')}` });
    }
  }
  const accs = (await meta.accounts()).filter((a) => a.active && !excluded(a));
  const health = await pool(accs, 4, async (a) => { try { return (await meta.adHealth(a.id, true)).map((x) => ({ ...x, client: a.name })); } catch { return []; } });
  for (const x of health.flat()) {
    out.push({ key: `ad:${x.key}`, client: x.client, level: x.kind === 'reprovado' || x.kind === 'erro' ? 'crit' : 'warn', kind: x.kind, text: `${x.ad ? `"${x.ad}" — ` : x.campaign ? `${x.campaign} — ` : ''}${x.detail}`, info: shortInfo(x) });
  }
  return out;
}
// ---------- formato da mensagem ----------
// *Diário Sincerus - Resumo (Tipo de aviso)*
// *Informações importantes*
// Cliente - Info
const cut = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t; };
function shortInfo(x) {
  if (x.kind === 'baixo alcance') return x.campaign ? `Campanha "${cut(x.campaign, 40)}" sem entrega ontem` : `${cut(x.detail.split(' — ')[0], 70)} — verificar restrição da Página`;
  if (x.kind === 'frequência alta') return `Frequência alta (${x.detail.replace(/^Frequência de /, '')})`;
  const label = { reprovado: 'Anúncio reprovado', erro: 'Anúncio com erro', duplicado: 'Anúncio duplicado' }[x.kind] || x.kind;
  return `${label}: "${cut(x.ad, 40)}"`;
}
const TYPE = { 'saldo/pagamento': 'Saldos', reprovado: 'Anúncios', erro: 'Anúncios', duplicado: 'Anúncios', 'baixo alcance': 'Entrega', 'frequência alta': 'Entrega' };
const typeOf = (list) => { const t = [...new Set(list.map((a) => TYPE[a.kind] || 'Alertas'))]; if (!t.length) return 'Sem alertas'; return t.length === 1 ? t[0] : `${t.slice(0, -1).join(', ')} e ${t[t.length - 1]}`; };
// por tipo (saldos, anúncios, entrega), mais grave primeiro e depois por cliente
const GROUP = ['Saldos', 'Anúncios', 'Entrega'];
const order = (list) => [...list].sort((a, b) => (GROUP.indexOf(TYPE[a.kind]) - GROUP.indexOf(TYPE[b.kind])) || (a.level === b.level ? 0 : a.level === 'crit' ? -1 : 1) || friendly(a.client).localeCompare(friendly(b.client), 'pt-BR'));
const lines = (list) => order(list).map((a) => `${friendly(a.client)} - ${a.info || a.text}`);
function message(kind, list) {
  const type = typeOf(list);
  const body = list.length ? lines(list).join('\n') : 'Nenhum alerta aberto. Tudo certo com as contas ✅';
  return { text: `*Diário Sincerus - ${kind} (${type})*\n\n*Informações importantes*\n\n${body}`, digest: { type: kind === 'Resumo' ? type : `Alerta: ${type}`, lines: lines(list) } };
}
const oneLine = (list) => list.slice(0, 8).map((a) => `${friendly(a.client)}: ${a.kind}`).join('; ') + (list.length > 8 ? `; e mais ${list.length - 8}` : '');

// a cada 30 min: só o que é novo desde o último envio
export async function alerts({ dry = false } = {}) {
  const state = readState();
  const now = await collectAlerts();
  const fresh = now.filter((a) => !state.alerts[a.key]);
  const out = { open: now.length, new: fresh.length };
  if (fresh.length && !dry) {
    const { text, digest } = message('Alerta', fresh);
    out.sent = await broadcast((phone) => sendText(phone, text, { digest, templateBody: `${fresh.length} novo(s) alerta(s): ${oneLine(fresh)}` }));
  }
  if (dry) out.preview = fresh.length ? message('Alerta', fresh).text : '';
  if (!dry) {
    const keep = Object.fromEntries(now.map((a) => [a.key, state.alerts[a.key] || new Date().toISOString()])); // resolvidos saem do estado
    writeState({ ...readState(), alerts: keep });
  }
  return out;
}

// todo dia 8h: resumo completo (saldos + todos os alertas abertos)
export async function daily({ dry = false } = {}) {
  const now = await collectAlerts();
  const { text, digest } = message('Resumo', now);
  if (dry) return { preview: text };
  const sent = await broadcast((phone) => sendText(phone, text, { digest, templateBody: `Resumo do dia: ${now.length} alerta(s) aberto(s)${now.length ? ` — ${oneLine(now)}` : ''}.` }));
  // o resumo também vale como "já avisado" para os alertas atuais
  writeState({ ...readState(), alerts: Object.fromEntries(now.map((a) => [a.key, new Date().toISOString()])) });
  return { alerts: now.length, sent };
}

export const JOBS = { weekly, monthly, daily, alerts, activeAds };

// ---------- agendador interno (confere a cada minuto; JOBS_ENABLED=1 liga) ----------
const running = new Set();
export async function runJob(name, opts = {}) {
  if (!JOBS[name]) throw Object.assign(new Error('Rotina inexistente.'), { status: 404 });
  if (running.has(name)) return { skipped: 'já em execução' };
  running.add(name);
  const t = Date.now();
  try {
    const r = await JOBS[name](opts);
    console.log(`[rotina ${name}] ok em ${Math.round((Date.now() - t) / 1000)}s`, JSON.stringify(r).slice(0, 500));
    return r;
  } catch (e) { console.error(`[rotina ${name}] erro:`, e.message); throw e; } finally { running.delete(name); }
}

// Verifica o que está no horário e roda (sem repetir): usado a cada minuto pelo agendador interno
// e pelo Cron da Hostinger (/api/jobs/run?job=tick&key=...), caso o processo durma sem visitas.
// o cron da Hostinger e o relógio interno chamam o tick; só um roda por vez
let ticking = false;
export async function tick() {
  if (process.env.JOBS_ENABLED !== '1') return { off: true };
  if (ticking) return { busy: true };
  // trava em arquivo também: se a Hostinger rodar mais de um processo, só um executa (trava velha de 30 min é ignorada)
  const lock = path.join(DATA, 'tick.lock');
  try { if (Date.now() - fs.statSync(lock).mtimeMs > 30 * 60000) fs.rmSync(lock, { force: true }); } catch { /* sem trava */ }
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { return { busy: true }; }
  ticking = true;
  try { return await tickOnce(); } finally { ticking = false; fs.closeSync(fd); fs.rmSync(lock, { force: true }); }
}
async function tickOnce() {
  const { date, hour, weekday } = nowBR();
  // primeira execução numa pasta de dados nova (ex.: servidor novo): considera o que já passou de hoje como enviado
  // e só registra os alertas atuais, sem mandar nada — evita repetir envios que já saíram
  if (!fs.existsSync(STATE)) {
    const now = await collectAlerts().catch(() => []);
    writeState({ lastDaily: hour >= 8 ? date : null, lastWeekly: weekday === 'Mon' && hour >= 8 ? isoWeek(date) : null, lastMonthly: date.endsWith('-01') && hour >= 8 ? date.slice(0, 7) : null, lastAlertsAt: Date.now(), alerts: Object.fromEntries(now.map((a) => [a.key, new Date().toISOString()])) });
    console.log('Rotinas: estado novo criado (nada enviado nesta primeira execução).');
    return { ran: [], seeded: true };
  }
  const st = readState();
  const due = [];
  if (hour >= 8 && st.lastDaily !== date) due.push(['daily', 'lastDaily', date]);
  if (weekday === 'Mon' && hour >= 8 && st.lastWeekly !== isoWeek(date)) due.push(['weekly', 'lastWeekly', isoWeek(date)]);
  if (date.endsWith('-01') && hour >= 8 && st.lastMonthly !== date.slice(0, 7)) due.push(['monthly', 'lastMonthly', date.slice(0, 7)]);
  // o resumo do dia já inclui todos os alertas: nesse caso não manda alerta em seguida
  if (due.some(([j]) => j === 'daily')) writeState({ ...readState(), lastAlertsAt: Date.now() });
  else if (hour >= 7 && hour <= 23 && Date.now() - (st.lastAlertsAt || 0) >= 28 * 60000) due.push(['alerts', 'lastAlertsAt', Date.now()]);
  for (const [job, mark, value] of due) {
    writeState({ ...readState(), [mark]: value }); // marca antes, para não repetir se demorar
    try { await runJob(job); } catch { /* registrado no log */ }
  }
  return { ran: due.map(([j]) => j) };
}
JOBS.tick = tick;

export function startScheduler() {
  if (process.env.JOBS_ENABLED !== '1') { console.log('Rotinas automáticas desligadas (JOBS_ENABLED≠1).'); return; }
  if (!whatsappConfigured() || !recipients().length) { console.warn('AVISO: rotinas ligadas, mas ViaZapi/REPORT_PHONES não configurados.'); }
  console.log(`Rotinas automáticas ligadas · destinatários: ${recipients().length} · dados em ${DATA}`);
  setInterval(() => { tick().catch((e) => console.error('agendador:', e.message)); }, 60 * 1000);
}
