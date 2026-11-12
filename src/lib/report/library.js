// Biblioteca de clientes do módulo de relatórios.
// Cada cliente guarda os dados de campanhas por período (vindos das importações).
// Ponto único de integração: quando a API da Meta estiver ligada, loadClientCampaigns()
// passa a buscar no servidor em vez do armazenamento local — a tela não muda.
import { isActive } from './compute';
import { identifyCar } from './parse';
import { api, metaAvailable } from '../api';

const KEY = 'sincerus.report.library.v1';

// Sem dados de clientes no código (repositório público): a lista nasce vazia e é preenchida pelas importações
const SEED = { clients: [], datasets: {} };

const clone = (o) => JSON.parse(JSON.stringify(o));
function read() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v?.clients) return v; } catch { /* vazio */ }
  return clone(SEED);
}
function write(lib) { try { localStorage.setItem(KEY, JSON.stringify(lib)); } catch { /* sem armazenamento */ } }

// Com a API da Meta configurada no servidor, os clientes são as contas de anúncio do Business Manager
export async function listClients() {
  const status = await metaAvailable();
  if (status.configured) {
    const accs = await api('/meta/accounts');
    return accs.map((a) => ({ id: a.id, name: a.name, account: `${a.id.replace('act_', '')}${a.business ? ` · ${a.business}` : ''}`, currency: a.currency, status: a.status, active: a.active, source: 'meta', periods: 0, lastPeriod: null }));
  }
  return listLocalClients();
}

const listLocalClients = () => {
  const lib = read();
  return lib.clients.map((c) => {
    const ds = lib.datasets[c.id] ?? [];
    const last = [...ds].sort((a, b) => (b.periodEnd > a.periodEnd ? 1 : -1))[0];
    return { ...c, periods: ds.length, lastPeriod: last ? [last.periodStart, last.periodEnd] : null };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
};

export function addClient(name, currency) {
  const lib = read();
  const id = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `cliente-${Date.now()}`;
  if (!lib.clients.some((c) => c.id === id)) lib.clients.push({ id, name: name.trim(), account: '', currency });
  write(lib);
  return id;
}

export function setClientCurrency(id, currency) {
  const lib = read();
  const c = lib.clients.find((x) => x.id === id);
  if (c) { c.currency = currency; write(lib); }
}

// Salva (ou atualiza) as campanhas de um cliente para um período. Campanhas com o mesmo nome + conjunto são substituídas.
export function saveCampaigns(clientId, periodStart, periodEnd, campaigns, source) {
  const lib = read();
  const list = (lib.datasets[clientId] ??= []);
  let ds = list.find((d) => d.periodStart === periodStart && d.periodEnd === periodEnd);
  if (!ds) { ds = { periodStart, periodEnd, campaigns: [] }; list.push(ds); }
  const strip = ({ key, open, ...c }) => ({ ...c, ads: c.ads.map(({ key: _k, ...a }) => a) });
  for (const c of campaigns.map(strip)) {
    const i = ds.campaigns.findIndex((x) => x.name === c.name && x.adset === c.adset);
    if (i >= 0) ds.campaigns[i] = c; else ds.campaigns.push(c);
  }
  ds.savedAt = new Date().toISOString().slice(0, 10);
  ds.source = source;
  write(lib);
}

export const campaignIsActive = (c) => (c.campaignStatus ? isActive(c.campaignStatus) : false) || c.ads.some((a) => isActive(a.status));

// Campanhas do cliente no período: ativas primeiro; as demais vêm marcadas para o usuário decidir
export async function loadClientCampaigns(clientId, periodStart, periodEnd, { refresh = false } = {}) {
  if (/^act_\d+$/.test(clientId)) {
    const r = await api(`/meta/report?account=${clientId}&since=${periodStart}&until=${periodEnd}${refresh ? '&refresh=1' : ''}`);
    const campaigns = r.campaigns.map((c) => ({ ...c, ads: c.ads.map((a) => ({ ...a, ...identifyCar(a.name) })), source: 'meta', filePeriods: [[periodStart, periodEnd]], periodConfirmed: true, printSpend: '', printImp: '', label: '', active: campaignIsActive(c) }));
    return { found: campaigns.length > 0, savedAt: r.fetchedAt.slice(0, 10), source: 'API da Meta (dados ao vivo)', campaigns, others: [] };
  }
  const lib = read();
  const ds = (lib.datasets[clientId] ?? []).find((d) => d.periodStart === periodStart && d.periodEnd === periodEnd);
  if (!ds) return { found: false, campaigns: [], others: (lib.datasets[clientId] ?? []).map((d) => [d.periodStart, d.periodEnd]) };
  const campaigns = clone(ds.campaigns).map((c) => ({ ...c, active: campaignIsActive(c) }));
  return { found: true, savedAt: ds.savedAt, source: ds.source, campaigns };
}

// Relatórios salvos (importações e prints confirmados), mais recentes primeiro
export function listSavedReports() {
  const lib = read();
  const names = Object.fromEntries(lib.clients.map((c) => [c.id, c.name]));
  return Object.entries(lib.datasets).flatMap(([id, list]) => list.map((d) => ({
    client: names[id] ?? id, periodStart: d.periodStart, periodEnd: d.periodEnd, savedAt: d.savedAt, source: d.source,
    campaigns: d.campaigns.length, ads: d.campaigns.reduce((t, c) => t + c.ads.length, 0),
  }))).sort((a, b) => (b.periodEnd > a.periodEnd ? 1 : -1));
}
