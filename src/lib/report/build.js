// Converte o rascunho da tela em um relatório pronto para compute()/HTML/XLSX
import { parseNumber } from './parse';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
export const NOTA_CAMBIO = 'Valores em real são estimativas pela cotação informada; o valor cobrado no cartão pode variar por IOF, spread e câmbio do dia da cobrança.';
export const NOTA_CAMBIO_BRL = 'Conta em real: os valores em R$ são os do Gerenciador; os valores em US$ são conversões pela cotação informada, apenas para referência.';

export function shortResult(type) {
  const t = (type || '').toLowerCase();
  if (/conversa|mensage|messaging/.test(t)) return 'conversas';
  if (/visita.*perfil|profile/.test(t)) return 'visitas ao perfil';
  if (/lead|cadastro/.test(t)) return 'leads';
  if (/compra|purchase|venda/.test(t)) return 'compras';
  if (/clique|click/.test(t)) return 'cliques';
  if (/seguidor|follow/.test(t)) return 'seguidores';
  return t ? t.split(/[,/]/)[0].trim() : 'resultados';
}

export function periodTexts(start, end) {
  const [ys, ms, ds] = (start || '').split('-');
  const [ye, me, de] = (end || '').split('-');
  const sameMonth = ys === ye && ms === me;
  const mon = (m) => MONTHS[Number(m) - 1] ?? '';
  return {
    periodLabel: `${dmy(start)} a ${dmy(end)}`,
    periodShort: sameMonth ? `${ds} – ${de} ${mon(ms).slice(0, 3).toUpperCase()} ${ys}` : `${dmy(start)} – ${dmy(end)}`,
    periodLong: sameMonth ? `${ds} – ${de} ${mon(ms)} ${ys}` : `${dmy(start)} a ${dmy(end)}`,
    monthName: sameMonth ? `${mon(ms)[0]?.toUpperCase()}${mon(ms).slice(1)}_${ys}` : `${ds}${ms}${ys}-${de}${me}${ye}`,
  };
}

// O relatório sempre mostra US$ e R$. Conta em real: os valores são convertidos para US$ (÷ cotação)
// e a coluna em R$ (US$ × cotação) volta ao valor original do Gerenciador.
export function draftToReport(d) {
  const p = periodTexts(d.periodStart, d.periodEnd);
  const rate = parseNumber(String(d.rate ?? ''), String(d.rate).includes(',') ? ',' : '.') ?? 0;
  const fromBrl = d.currency === 'BRL';
  const m = (v) => (v == null ? v : fromBrl ? (rate ? v / rate : null) : v);
  const today = new Date();
  const safe = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return {
    client: d.client || 'Cliente',
    periodStart: d.periodStart, periodEnd: d.periodEnd, ...p,
    currency: 'USD',
    originalCurrency: d.currency,
    rate,
    rateSource: d.rateSource,
    rateNote: fromBrl ? NOTA_CAMBIO_BRL : NOTA_CAMBIO,
    generatedAt: today.toLocaleDateString('pt-BR'),
    fileName: `Relatorio_${safe(d.client || 'Cliente')}_${p.monthName}`,
    campaigns: d.campaigns.map((c) => {
      let periodStatus = 'warn', periodNote = 'Período não confirmado.';
      if (c.filePeriods?.length) {
        const match = c.filePeriods.every(([s, e]) => s === d.periodStart && e === d.periodEnd);
        periodStatus = match ? 'ok' : 'warn';
        periodNote = match ? `Arquivo exportado para ${dmy(d.periodStart)} a ${dmy(d.periodEnd)}.` : `Período no arquivo (${c.filePeriods.map(([s, e]) => `${dmy(s)} a ${dmy(e)}`).join('; ')}) diferente do relatório.`;
      } else if (c.periodConfirmed) {
        periodStatus = 'ok'; periodNote = 'Período confirmado pelo usuário (sem datas no arquivo/print).';
      }
      const num = (v) => (v === '' || v == null ? null : parseNumber(String(v), ','));
      return {
        ...c,
        resultShort: c.resultShort || shortResult(c.resultType),
        printTotals: { spend: m(num(c.printSpend)), imp: num(c.printImp) },
        periodStatus, periodNote,
        hasClicks: c.ads.some((a) => a.clicks != null),
        ads: c.ads.map((a) => ({ ...a, spend: m(a.spend ?? 0), cpr: m(a.cpr), cpm: m(a.cpm) })),
      };
    }),
  };
}

export async function fetchPtax(start, end) {
  const f = (iso) => { const [y, m, dd] = iso.split('-'); return `${m}-${dd}-${y}`; };
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${f(start)}'&@dataFinalCotacao='${f(end)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('O Banco Central não respondeu. Tente de novo ou digite a cotação.');
  const vals = (await res.json()).value ?? [];
  if (!vals.length) throw new Error('Sem cotações PTAX publicadas para esse período.');
  const avg = vals.reduce((s, v) => s + v.cotacaoVenda, 0) / vals.length;
  const rate = Math.round(avg * 10000) / 10000;
  const first = vals[0].dataHoraCotacao.slice(0, 10).split('-').reverse().join('/');
  const last = vals.at(-1).dataHoraCotacao.slice(0, 10).split('-').reverse().join('/');
  return {
    rate,
    source: `PTAX de venda do Banco Central do Brasil — média das ${vals.length} cotações diárias de ${first} a ${last}, consultadas na API PTAX/Olinda do BCB em ${new Date().toLocaleDateString('pt-BR')}.`,
  };
}
