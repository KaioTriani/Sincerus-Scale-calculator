// Dados reais do dashboard e da página de clientes (API da Meta, últimos 6 meses fechados).
// Contas em dólar são convertidas para real pela PTAX média de venda de cada mês.
import { useEffect, useState } from 'react';
import { api, metaAvailable } from './api';

const pad = (n) => String(n).padStart(2, '0');
export function lastMonths(n = 6, ref = new Date()) {
  const end = new Date(ref.getFullYear(), ref.getMonth(), 0); // último dia do mês passado
  const start = new Date(end.getFullYear(), end.getMonth() - (n - 1), 1);
  const months = [];
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) months.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  return { since: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`, until: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`, months };
}
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const monthLabel = (ym) => `${MONTH_NAMES[Number(ym.slice(5)) - 1]}/${ym.slice(2, 4)}`;

async function ptaxByMonth(since, until) {
  const f = (iso) => { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y}`; };
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${f(since)}'&@dataFinalCotacao='${f(until)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
  const vals = (await (await fetch(url)).json()).value ?? [];
  const acc = {};
  for (const v of vals) { const m = v.dataHoraCotacao.slice(0, 7); (acc[m] ??= []).push(v.cotacaoVenda); }
  return Object.fromEntries(Object.entries(acc).map(([m, l]) => [m, Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10000) / 10000]));
}

export async function loadOverview({ refresh = false } = {}) {
  const status = await metaAvailable();
  if (!status.configured) return { live: false };
  const { since, until, months } = lastMonths();
  const [ov, rates] = await Promise.all([
    api(`/meta/overview?since=${since}&until=${until}${refresh ? '&refresh=1' : ''}`),
    ptaxByMonth(since, until).catch(() => ({})),
  ]);
  const accounts = ov.accounts.map((a) => {
    const byMonth = {};
    for (const m of months) {
      const row = a.months.find((x) => x.month === m) || { spend: 0, imp: 0, reach: 0, conversations: 0, leads: 0 };
      const rate = a.currency === 'USD' ? rates[m] : a.currency === 'BRL' ? 1 : null;
      byMonth[m] = { ...row, spendBRL: rate ? row.spend * rate : null };
    }
    return { ...a, byMonth };
  });
  return { live: true, since, until, months, rates, accounts, fetchedAt: ov.fetchedAt };
}

export function useOverview() {
  const [state, setState] = useState({ loading: true });
  const run = (opts) => {
    setState((s) => ({ ...s, loading: true }));
    loadOverview(opts).then((d) => setState({ loading: false, ...d })).catch((e) => setState({ loading: false, live: false, error: e.message }));
  };
  useEffect(() => { run(); }, []);
  return { ...state, refresh: () => run({ refresh: true }) };
}
