// Relatório de ANÚNCIOS ATIVOS: para cada cliente selecionado, as campanhas ativas no mesmo layout das
// tabelas do relatório de desempenho ("01 / ANÚNCIOS ATIVOS", "NÃO ATIVOS", subtotais e total), sem capa,
// gráficos ou validação. Vários clientes saem no mesmo PDF, um depois do outro, na ordem da lista.
import { loadClientCampaigns } from './library';
import { draftToReport } from './build';
import { compute, isActive } from './compute';
import { buildReportHtml, reportCss } from './html';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
const uid = () => Math.random().toString(36).slice(2, 9);

// accounts: [{ id, name, currency }] · período (AAAA-MM-DD) · rate/rateSource: cotação USD→BRL
export async function buildActiveAdsReport(accounts, { periodStart, periodEnd, rate, rateSource }, logoDataUrl, onProgress) {
  // busca os dados de até 4 clientes ao mesmo tempo (cada um leva alguns segundos na Meta)
  const data = new Array(accounts.length);
  let next = 0, done = 0;
  onProgress?.(0, accounts.length, '');
  await Promise.all(Array.from({ length: Math.min(4, accounts.length) }, async () => {
    while (next < accounts.length) {
      const k = next++;
      data[k] = await loadClientCampaigns(accounts[k].id, periodStart, periodEnd);
      onProgress?.(++done, accounts.length, accounts[k].name);
    }
  }));

  const pages = [];
  const skipped = [];
  accounts.forEach((a, k) => {
    // só campanhas com pelo menos um anúncio ativo agora
    const campaigns = data[k].campaigns.filter((c) => c.ads.some((ad) => isActive(ad.status)));
    if (!campaigns.length) { skipped.push(a.name); return; }
    const report = draftToReport({
      client: a.name, clientId: a.id, periodStart, periodEnd, currency: a.currency, rate, rateSource,
      campaigns: campaigns.map((c) => ({ ...c, key: uid(), periodConfirmed: true, ads: c.ads.map((ad) => ({ ...ad, key: uid() })) })),
    });
    pages.push(...buildReportHtml(report, compute(report), logoDataUrl, { tablesOnly: true, pagesOnly: true }));
  });

  const day = new Date().toISOString().slice(0, 10);
  const fileName = accounts.length === 1 ? `Anuncios-ativos_${slug(accounts[0].name)}_${day}` : `Anuncios-ativos_${accounts.length}-clientes_${day}`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(fileName)}</title><style>${reportCss}</style></head><body>${pages.join('\n')}</body></html>`;
  return { html, fileName, skipped, empty: !pages.length };
}
