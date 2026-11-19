// Rotinas automáticas (horário de Brasília):
//  - daily:     todo dia às 8h — resumo dos alertas abertos (saldo/pagamento, anúncios, entrega)
//  - alerts:    a cada 30 min (7h–23h) — só os alertas NOVOS
//  - activeAds: segunda e quinta às 9h — mensagem com os anúncios ativos por cliente (sem PDF)
//  - weekly:    toda segunda às 8h — relatório para cliente em PDF, um arquivo por cliente (últimos 7 dias × 7 anteriores)
//  - monthly:   todo dia 1º às 8h — relatório interno do mês anterior: consolidado da operação + detalhe por cliente
// Envio pelo WhatsApp (ViaZapi/Chatwoot) para REPORT_PHONES. Estado e registro em DATA_DIR (ver paths.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as meta from './meta.mjs';
import { htmlToPdf } from './pdf.mjs';
import { whatsappConfigured, recipients, sendText, sendDocument, broadcast } from './whatsapp.mjs';
import { DATA_DIR } from './paths.mjs';
import { buildMonthlySummaryHtml } from './monthlySummary.mjs';

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

const cut = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t; };
// ---------- rotinas ----------
// Relatório semanal: um PDF por cliente (últimos 7 dias × 7 dias anteriores), enviado em mensagens separadas.
// Cada PDF é montado só com os dados daquela conta de anúncios.
const fileSafe = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
export async function weekly({ dry = false } = {}) {
  const { date } = nowBR();
  const since = addDays(date, -7), until = addDays(date, -1);
  const cmp = [addDays(since, -7), addDays(since, -1)];
  const R = await reports();
  const accs = (await meta.accounts(true)).filter((a) => !excluded(a) && a.statusCode !== 2 && a.statusCode !== 101);
  const needUsd = accs.some((a) => a.currency === 'USD');
  const fx = needUsd ? await ptax(since, until) : { rate: 1, source: '' };
  const errors = [];
  const list = (await pool(accs, 3, async (a) => {
    try {
      const data = await meta.clientReport(a.id, since, until, cmp[0], cmp[1], true);
      if (!data.campaigns.length) return null; // sem veiculação na semana: não gera relatório
      const model = R.computeClientReport(data, { rate: fx.rate, rateSource: fx.source, ceiling: 6, responseRef: 0.01, freqLimit: 3, clientName: friendly(a.name), compareName: 'Semana anterior' });
      return { account: a.id, model, texts: R.draftTexts(model) };
    } catch (e) { errors.push({ client: friendly(a.name), error: e.message }); return null; }
  })).filter(Boolean);
  const period = `${dm(since)} a ${dm(until)}`;
  const out = { period: [since, until], clients: [], errors };
  for (const x of list) {
    const name = x.model.client;
    try {
      const { html } = R.buildClientReportsHtml([x]); // um cliente por documento
      const file = `Relatorio_semanal_${fileSafe(name)}_${dm(since).replace('/', '-')}_a_${dm(until).replace('/', '-')}`;
      const r = await sendPdf(html, file, `Relatório semanal · ${name} · ${period}`, { name: 'equipe', title: `o relatório semanal de ${name}`, period }, { dry });
      out.clients.push({ client: name, account: x.account, ...r });
    } catch (e) { errors.push({ client: name, error: e.message }); }
  }
  return out;
}

// Anúncios ativos: mensagem de WhatsApp (sem PDF) com, por cliente, campanhas ativas e quantos anúncios cada uma tem.
// Dividida em partes de até 10 clientes (limite do modelo da Meta e do tamanho da mensagem).
export async function activeAds({ dry = false } = {}) {
  const data = await meta.activeAds(true);
  const accs = data.accounts.filter((a) => a.campaigns.length && !excluded(a)).sort((a, b) => friendly(a.name).localeCompare(friendly(b.name), 'pt-BR'));
  if (!accs.length) return { clients: 0, ads: 0 };
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const adsIn = (c) => c.adsets.reduce((t, s) => t + s.ads.length, 0);
  const blocks = accs.map((a) => {
    const n = a.campaigns.reduce((t, c) => t + adsIn(c), 0);
    const head = `${friendly(a.name)} - ${plural(a.campaigns.length, 'campanha', 'campanhas')} · ${plural(n, 'anúncio', 'anúncios')}`;
    // até 8 campanhas por cliente (as com mais anúncios); o resto vira "e mais N"
    const top = [...a.campaigns].sort((x, y) => adsIn(y) - adsIn(x));
    const camps = top.slice(0, 8).map((c) => `   • ${cut(c.name, 48)} (${adsIn(c)})`).concat(top.length > 8 ? [`   • e mais ${plural(top.length - 8, 'campanha', 'campanhas')}`] : []).join('\n');
    return { line: head, text: `*${head}*\n${camps}`, ads: n, campaigns: a.campaigns.length };
  });
  const total = { clients: blocks.length, campaigns: blocks.reduce((t, b) => t + b.campaigns, 0), ads: blocks.reduce((t, b) => t + b.ads, 0) };
  const chunks = [];
  for (const b of blocks) {
    const last = chunks[chunks.length - 1];
    if (!last || last.length >= 10 || last.reduce((t, x) => t + x.text.length + 2, 0) + b.text.length > 3300) chunks.push([b]); else last.push(b);
  }
  const day = dm(nowBR().date);
  const parts = chunks.map((c, i) => {
    const tag = chunks.length > 1 ? ` · parte ${i + 1}/${chunks.length}` : '';
    const end = i === chunks.length - 1 ? `\n\nTotal: ${plural(total.clients, 'cliente', 'clientes')} · ${plural(total.campaigns, 'campanha', 'campanhas')} · ${plural(total.ads, 'anúncio ativo', 'anúncios ativos')}` : '';
    return {
      text: `*Diário Sincerus - Resumo (Anúncios ativos · ${day}${tag})*\n\n*Informações importantes*\n\n${c.map((b) => b.text).join('\n\n')}${end}`,
      digest: { type: `Anúncios ativos · ${day}${tag}`, lines: c.map((b) => b.line) },
    };
  });
  if (dry) return { ...total, parts: parts.length, preview: parts.map((p) => p.text) };
  const sent = await broadcast(async (phone) => {
    const via = [];
    for (const p of parts) via.push(await sendText(phone, p.text, { digest: p.digest, templateBody: p.digest.lines.join('; ') }));
    return via.join(',');
  });
  return { ...total, parts: parts.length, sent };
}

// PDF de anúncios ativos: não é mais enviado automaticamente; continua disponível para gerar sob demanda
export async function activeAdsPdf({ dry = true } = {}) {
  const R = await reports();
  const data = await meta.activeAds(true);
  const accs = data.accounts.filter((a) => a.campaigns.length && !excluded(a));
  if (!accs.length) return { clients: 0 };
  const when = new Date(data.fetchedAt);
  const { html, fileName } = R.buildActiveAdsHtml(accs, logo(), { when });
  const n = accs.reduce((t, a) => t + R.clientAdList(a).length, 0);
  return { clients: accs.length, ads: n, ...(await sendPdf(html, fileName, `Anúncios ativos · ${accs.length} clientes, ${n} anúncios`, { name: 'equipe', title: 'a lista de anúncios ativos', period: when.toLocaleDateString('pt-BR', { timeZone: TZ }) }, { dry })) };
}

// Relatório mensal interno (dia 1º): consolidado da operação + seção detalhada de cada cliente, mês anterior completo,
// com comparação ao mês retrasado. Uso interno (não vai para clientes).
export async function monthly({ dry = false } = {}) {
  const { date } = nowBR();
  const [y, m] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  const prevFirst = new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10);
  const prevLast = new Date(Date.UTC(y, m - 2, 0)).toISOString().slice(0, 10);
  const R = await reports();
  const accs = (await meta.accounts(true)).filter((a) => !excluded(a) && a.statusCode !== 2 && a.statusCode !== 101);
  const fx = await ptax(first, last);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const errors = [];
  const results = await pool(accs, 3, async (a) => {
    try {
      const [r, sum] = await Promise.all([meta.report(a.id, first, last, true), meta.clientReport(a.id, first, last, prevFirst, prevLast, true)]);
      const campaigns = r.campaigns.filter((c) => c.ads.some((x) => x.spend > 0)).map((c) => ({
        ...c, key: uid(), label: '', printSpend: '', printImp: '', source: 'meta', filePeriods: [[first, last]], periodConfirmed: true,
        ads: c.ads.map((x) => ({ ...x, key: uid(), ...R.identifyCar(x.name) })),
      }));
      if (!campaigns.length || !(sum.total?.spend > 0)) return null;
      const report = R.draftToReport({ client: a.name, clientId: a.id, periodStart: first, periodEnd: last, currency: a.currency, rate: String(fx.rate).replace('.', ','), rateSource: fx.source, campaigns });
      const label = sum.campaigns.find((c) => c.goal === sum.mainIndicator)?.resultLabel || 'Resultados';
      return {
        doc: R.buildReportHtml(report, R.compute(report), logo()),
        row: { client: friendly(a.name), currency: a.currency, rate: fx.rate, label, cur: sum.total, prev: sum.compare?.total || null, campaigns: sum.campaigns },
      };
    } catch (e) { errors.push({ client: friendly(a.name), error: e.message }); return null; }
  });
  const ok = results.filter(Boolean);
  if (!ok.length) return { clients: 0, errors };
  const mes = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const summary = buildMonthlySummaryHtml(ok.map((x) => x.row), { month: mes(first), prevMonth: mes(prevFirst), logo: logo(), rateSource: fx.source });
  const html = mergeHtml(ok.map((x) => x.doc)).replace('<body>', () => `<body>${summary}`);
  const r = await sendPdf(html, `Relatorio_interno_${first.slice(0, 7)}`, `Relatório interno de desempenho · ${mes(first)} · ${ok.length} clientes`, { name: 'equipe', title: 'o relatório interno do mês', period: mes(first) }, { dry });
  return { month: first.slice(0, 7), clients: ok.length, totalSpendBRL: Math.round(ok.reduce((t, x) => t + x.row.cur.spend * (x.row.currency === 'USD' ? fx.rate : 1), 0)), errors, ...r };
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

export const JOBS = { weekly, monthly, daily, alerts, activeAds, activeAdsPdf };

// ---------- registro de execuções (DATA_DIR/jobs-log.jsonl) ----------
const LOG = path.join(DATA, 'jobs-log.jsonl');
function appendLog(entry) {
  try {
    fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
    const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n');
    if (lines.length > 600) fs.writeFileSync(LOG, `${lines.slice(-300).join('\n')}\n`);
  } catch { /* registro é opcional */ }
}
export function jobLog(n = 30) {
  try { return fs.readFileSync(LOG, 'utf8').trim().split('\n').slice(-n).map((l) => JSON.parse(l)).reverse(); } catch { return []; }
}
// resumo curto do resultado para o registro (sem textos longos)
const brief = (r) => JSON.stringify(r, (k, v) => (k === 'preview' ? undefined : v)).slice(0, 600);

// ---------- agendador interno (confere a cada minuto; JOBS_ENABLED=1 liga) ----------
const running = new Set();
export async function runJob(name, opts = {}) {
  if (!JOBS[name]) throw Object.assign(new Error('Rotina inexistente.'), { status: 404 });
  if (running.has(name)) return { skipped: 'já em execução' };
  running.add(name);
  const t = Date.now();
  const base = { at: new Date().toISOString(), job: name, dry: !!opts.dry };
  try {
    const r = await JOBS[name](opts);
    const sec = Math.round((Date.now() - t) / 1000);
    // envio que falhou para algum destinatário conta como erro parcial
    const failed = JSON.stringify(r).includes('"ok":false') || (r?.errors?.length > 0);
    console.log(`[rotina ${name}] ${failed ? 'concluída com falhas' : 'ok'} em ${sec}s`, brief(r));
    appendLog({ ...base, ok: !failed, partial: failed || undefined, sec, result: brief(r) });
    return r;
  } catch (e) {
    console.error(`[rotina ${name}] erro:`, e.message);
    appendLog({ ...base, ok: false, sec: Math.round((Date.now() - t) / 1000), error: e.message });
    throw e;
  } finally { running.delete(name); }
}

// ---------- agenda (horário de Brasília) ----------
// daily: todo dia ≥8h · alerts: a cada 30 min, 7h–23h (não logo após o daily) · weekly: segunda ≥8h
// monthly: dia 1º ≥8h · activeAds: ACTIVE_ADS_DAYS (padrão segunda e quinta) ≥ ACTIVE_ADS_HOUR (padrão 9h)
const AA_DAYS = () => (process.env.ACTIVE_ADS_DAYS || 'Mon,Thu').split(',').map((s) => s.trim());
const AA_HOUR = () => Number(process.env.ACTIVE_ADS_HOUR || 9);
export function dueJobs({ date, hour, weekday }, st, nowMs = Date.now()) {
  const due = [];
  if (hour >= 8 && st.lastDaily !== date) due.push(['daily', 'lastDaily', date]);
  if (weekday === 'Mon' && hour >= 8 && st.lastWeekly !== isoWeek(date)) due.push(['weekly', 'lastWeekly', isoWeek(date)]);
  if (date.endsWith('-01') && hour >= 8 && st.lastMonthly !== date.slice(0, 7)) due.push(['monthly', 'lastMonthly', date.slice(0, 7)]);
  if (AA_DAYS().includes(weekday) && hour >= AA_HOUR() && st.lastActiveAds !== date) due.push(['activeAds', 'lastActiveAds', date]);
  // o resumo do dia já inclui todos os alertas: nesse caso não manda alerta em seguida
  if (!due.some(([j]) => j === 'daily') && hour >= 7 && hour <= 23 && nowMs - (st.lastAlertsAt || 0) >= 28 * 60000) due.push(['alerts', 'lastAlertsAt', nowMs]);
  return due;
}

// Verifica o que está no horário e roda (sem repetir): usado a cada minuto pelo agendador interno
// e pelo Cron da Hostinger (/api/jobs/run?job=tick&key=...), caso o processo durma sem visitas.
// o cron da Hostinger e o relógio interno chamam o tick; só um roda por vez
let ticking = false;
export async function tick() {
  if (process.env.JOBS_ENABLED !== '1') return { off: true };
  if (ticking) return { busy: true };
  // trava em arquivo também: se a Hostinger rodar mais de um processo, só um executa (trava velha de 3h é ignorada: o mensal pode demorar)
  const lock = path.join(DATA, 'tick.lock');
  try { if (Date.now() - fs.statSync(lock).mtimeMs > 3 * 3600000) fs.rmSync(lock, { force: true }); } catch { /* sem trava */ }
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { return { busy: true }; }
  ticking = true;
  try { return await tickOnce(); } finally { ticking = false; fs.closeSync(fd); fs.rmSync(lock, { force: true }); }
}
async function tickOnce() {
  const now = nowBR();
  // primeira execução numa pasta de dados nova (ex.: servidor novo): considera o que já passou de hoje como enviado
  // e só registra os alertas atuais, sem mandar nada — evita repetir envios que já saíram
  if (!fs.existsSync(STATE)) {
    const open = await collectAlerts().catch(() => []);
    const seed = { alerts: Object.fromEntries(open.map((a) => [a.key, new Date().toISOString()])) };
    for (const [, mark, value] of dueJobs(now, {})) seed[mark] = value;
    seed.lastAlertsAt = Date.now();
    writeState(seed);
    appendLog({ at: new Date().toISOString(), job: 'tick', ok: true, result: 'estado novo criado; nada enviado' });
    return { ran: [], seeded: true };
  }
  // rotina nova (anúncios ativos por mensagem) num servidor que já rodava: começa no próximo dia agendado, sem disparo surpresa hoje
  if (!('lastActiveAds' in readState())) writeState({ ...readState(), lastActiveAds: now.date });
  const due = dueJobs(now, readState());
  if (due.some(([j]) => j === 'daily')) writeState({ ...readState(), lastAlertsAt: Date.now() });
  for (const [job, mark, value] of due) {
    writeState({ ...readState(), [mark]: value }); // marca antes, para não repetir se demorar ou falhar
    try { await runJob(job); } catch { /* registrado no log */ }
  }
  return { ran: due.map(([j]) => j) };
}
JOBS.tick = tick;

// situação das rotinas: últimos envios marcados e registro recente
export function status() {
  const st = readState();
  const { alerts: open, ...marks } = st;
  return { enabled: process.env.JOBS_ENABLED === '1', now: nowBR(), dataDir: DATA, marks: { ...marks, lastAlertsAt: marks.lastAlertsAt ? new Date(marks.lastAlertsAt).toISOString() : null }, openAlerts: Object.keys(open || {}).length,
    schedule: { daily: 'todo dia, 8h', alerts: 'a cada 30 min, 7h–23h', weekly: 'segunda, 8h (um PDF por cliente)', monthly: 'dia 1º, 8h (mês anterior)', activeAds: `${AA_DAYS().join(', ')} · ${AA_HOUR()}h (mensagem)` }, log: jobLog(30) };
}

export function startScheduler() {
  if (process.env.JOBS_ENABLED !== '1') { console.log('Rotinas automáticas desligadas (JOBS_ENABLED≠1).'); return; }
  if (!whatsappConfigured() || !recipients().length) { console.warn('AVISO: rotinas ligadas, mas ViaZapi/REPORT_PHONES não configurados.'); }
  console.log(`Rotinas automáticas ligadas · destinatários: ${recipients().length} · dados em ${DATA}`);
  setInterval(() => { tick().catch((e) => console.error('agendador:', e.message)); }, 60 * 1000);
}
