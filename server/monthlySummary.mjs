// Páginas de abertura do relatório mensal interno: consolidado da operação (todos os clientes),
// desempenho por cliente com comparação ao mês anterior e comparação entre campanhas.
// Entra antes das seções detalhadas de cada cliente (A4 paisagem, mesmo tamanho do relatório interno).

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const brl = (v) => (v == null || !Number.isFinite(v) ? '—' : `R$ ${num(v, 2)}`);
const money = (v, cur) => (v == null || !Number.isFinite(v) ? '—' : `${cur === 'USD' ? 'US$' : 'R$'} ${num(v, 2)}`);
const pct = (a, b) => (a == null || b == null || !b ? null : (a - b) / b);
// variação: verde quando melhora (custo cai, o resto sobe)
function delta(a, b, { lowerIsBetter = false } = {}) {
  const p = pct(a, b);
  if (p == null) return '<span class="ms-d">—</span>';
  const good = lowerIsBetter ? p < 0 : p > 0;
  const cls = Math.abs(p) < 0.005 ? '' : good ? 'up' : 'down';
  return `<span class="ms-d ${cls}">${p > 0 ? '+' : ''}${num(p * 100, 0)}%</span>`;
}

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
.ms-page { width: 297mm; height: 210mm; padding: 13mm 15mm 11mm; box-sizing: border-box; page-break-after: always; break-after: page; position: relative; overflow: hidden;
  font-family: 'Poppins', Verdana, sans-serif; color: #12141A; font-size: 8.4pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
.ms-top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #F76000; padding-bottom: 3.5mm; margin-bottom: 5mm; }
.ms-top img { height: 9mm; }
.ms-kicker { font-size: 7.4pt; letter-spacing: .12em; text-transform: uppercase; color: #F76000; font-weight: 600; }
.ms-title { font-size: 17pt; font-weight: 700; margin: 1mm 0 0; }
.ms-sub { color: #5B6068; font-size: 8pt; text-align: right; }
.ms-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3mm; margin-bottom: 5mm; }
.ms-kpi { border: 1px solid #E2E3E5; border-radius: 2.5mm; padding: 3mm 3.5mm; }
.ms-kpi b { display: block; font-size: 13pt; font-weight: 700; margin: 1mm 0 .5mm; }
.ms-kpi span { color: #5B6068; font-size: 7pt; text-transform: uppercase; letter-spacing: .06em; }
.ms-kpi .ms-d { font-size: 7.4pt; }
h3.ms-h { font-size: 10pt; margin: 0 0 2.5mm; font-weight: 600; }
.ms-note { color: #8A8F98; font-size: 6.8pt; margin-top: 2mm; line-height: 1.45; }
table.ms-t { width: 100%; border-collapse: collapse; font-size: 7.4pt; }
.ms-t th { text-align: right; color: #5B6068; font-weight: 600; font-size: 6.6pt; text-transform: uppercase; letter-spacing: .04em; padding: 1.6mm 1.6mm; border-bottom: 1.5px solid #12141A; }
.ms-t td { text-align: right; padding: 1.5mm 1.6mm; border-bottom: 1px solid #ECEDEF; white-space: nowrap; }
.ms-t th:first-child, .ms-t td:first-child, .ms-t .l { text-align: left; }
.ms-t td.l { white-space: normal; line-height: 1.35; }
.ms-t tr.tot td { font-weight: 700; border-top: 1.5px solid #12141A; border-bottom: none; }
.ms-d { font-size: 6.8pt; color: #8A8F98; margin-left: 1mm; }
.ms-d.up { color: #19A35A; } .ms-d.down { color: #D23B2E; }
.ms-bars { display: grid; grid-template-columns: 38mm 1fr 26mm; gap: 1.3mm 3mm; align-items: center; font-size: 7.4pt; }
.ms-bar { height: 3.4mm; background: #F2F2F3; border-radius: 1mm; overflow: hidden; }
.ms-bar i { display: block; height: 100%; background: linear-gradient(90deg, #F76000, #FF8A1F); }
.ms-cols { display: grid; grid-template-columns: 1.05fr 1fr; gap: 8mm; }
.ms-tag { display: inline-block; font-size: 6.4pt; color: #5B6068; background: #F2F2F3; border-radius: 1mm; padding: .3mm 1.4mm; }
.ms-foot { position: absolute; left: 15mm; right: 15mm; bottom: 6mm; display: flex; justify-content: space-between; color: #A9ADB4; font-size: 6.6pt; }
`;

// rows: [{ client, currency, rate, label, cur: total, prev: total|null, campaigns: [...] }]  (rate = câmbio para R$)
export function buildMonthlySummaryHtml(rows, { month, prevMonth, logo, rateSource }) {
  const toBrl = (r, v) => (v == null ? null : v * (r.currency === 'USD' ? r.rate : 1));
  const sum = (f) => rows.reduce((t, r) => t + (f(r) || 0), 0);
  const T = {
    spend: sum((r) => toBrl(r, r.cur.spend)), spendPrev: sum((r) => toBrl(r, r.prev?.spend)),
    results: sum((r) => r.cur.results), resultsPrev: sum((r) => r.prev?.results),
    conv: sum((r) => r.cur.conversations), convPrev: sum((r) => r.prev?.conversations),
    leads: sum((r) => r.cur.leads), leadsPrev: sum((r) => r.prev?.leads),
    reach: sum((r) => r.cur.reach), imp: sum((r) => r.cur.imp),
    revenue: sum((r) => toBrl(r, r.cur.revenue)), revenuePrev: sum((r) => toBrl(r, r.prev?.revenue)),
  };
  const hasPrev = rows.some((r) => r.prev);
  const hasRevenue = rows.some((r) => r.cur.revenue);
  const cpr = T.results ? T.spend / T.results : null, cprPrev = T.resultsPrev ? T.spendPrev / T.resultsPrev : null;
  const top = `<div class="ms-top"><div><div class="ms-kicker">Relatório interno · uso da equipe</div><div class="ms-title">Consolidado da operação — ${esc(month)}</div></div>
    <div class="ms-sub">${logo ? `<img src="${logo}" alt=""><br>` : ''}${rows.length} clientes · comparação com ${esc(prevMonth)}</div></div>`;
  const foot = (n) => `<div class="ms-foot"><span>Sincerus Scale · dados da Meta Ads (contas conectadas)</span><span>Consolidado ${n}</span></div>`;

  const kpis = [
    ['Investimento total', brl(T.spend), hasPrev ? delta(T.spend, T.spendPrev) : ''],
    ['Resultados', num(T.results), hasPrev ? delta(T.results, T.resultsPrev) : ''],
    ['Conversas iniciadas', num(T.conv), hasPrev ? delta(T.conv, T.convPrev) : ''],
    ['Leads', num(T.leads), hasPrev ? delta(T.leads, T.leadsPrev) : ''],
    ['Custo médio por resultado', brl(cpr), hasPrev ? delta(cpr, cprPrev, { lowerIsBetter: true }) : ''],
    hasRevenue ? ['Receita atribuída · ROAS', `${brl(T.revenue)}`, `<span class="ms-d">ROAS ${T.spend ? num(T.revenue / T.spend, 2) : '—'}</span>`] : ['Alcance (soma)', num(T.reach), `<span class="ms-d">${num(T.imp)} impressões</span>`],
  ].map(([k, v, d]) => `<div class="ms-kpi"><span>${k}</span><b>${v}</b>${d}</div>`).join('');

  const sorted = [...rows].sort((a, b) => toBrl(b, b.cur.spend) - toBrl(a, a.cur.spend));
  const max = Math.max(...sorted.map((r) => toBrl(r, r.cur.spend)), 1);
  const bars = sorted.map((r) => `<div>${esc(r.client)}</div><div class="ms-bar"><i style="width:${(toBrl(r, r.cur.spend) / max) * 100}%"></i></div><div style="text-align:right">${brl(toBrl(r, r.cur.spend))}</div>`).join('');

  // ranking de custo por resultado (mesmo tipo de resultado para comparar)
  const camps = rows.flatMap((r) => (r.campaigns || []).filter((c) => c.spend > 0).map((c) => ({ ...c, client: r.client, brl: toBrl(r, c.spend), cprBrl: c.results ? toBrl(r, c.spend) / c.results : null })));
  const topCamps = [...camps].sort((a, b) => b.brl - a.brl).slice(0, 8);

  const page1 = `<section class="ms-page">${top}<div class="ms-kpis">${kpis}</div>
    <div class="ms-cols"><div><h3 class="ms-h">Investimento por cliente</h3><div class="ms-bars">${bars}</div></div>
    <div><h3 class="ms-h">Campanhas com maior investimento</h3><table class="ms-t"><tr><th>Cliente · campanha</th><th>Investimento</th><th>Resultados</th><th>Custo/res.</th></tr>
    ${topCamps.map((c) => `<tr><td class="l"><b>${esc(c.client)}</b> · ${esc(String(c.name).length > 34 ? `${String(c.name).slice(0, 33)}…` : c.name)}<br><span class="ms-tag">${esc(c.resultLabel || 'Resultados')}</span></td><td>${brl(c.brl)}</td><td>${num(c.results)}</td><td>${brl(c.cprBrl)}</td></tr>`).join('')}</table></div></div>
    <div class="ms-note">Valores em R$; contas em dólar convertidas pela ${esc(rateSource || 'cotação do período')}. "Resultados" segue o indicador principal de cada cliente (conversas, leads, visitas ao perfil, compras…), como na coluna Resultados do Gerenciador — por isso o custo médio consolidado é só uma referência; compare custos dentro do mesmo tipo de resultado.</div>${foot(1)}</section>`;

  const line = (r) => {
    const c = r.cur, p = r.prev;
    const cprC = c.results ? c.spend / c.results : null, cprP = p?.results ? p.spend / p.results : null;
    return `<tr><td class="l"><b>${esc(r.client)}</b><br><span class="ms-tag">${esc(r.label)}</span></td>
      <td>${money(c.spend, r.currency)}${delta(c.spend, p?.spend)}</td><td>${num(c.results)}${delta(c.results, p?.results)}</td>
      <td>${money(cprC, r.currency)}${delta(cprC, cprP, { lowerIsBetter: true })}</td>
      <td>${num(c.conversations)}</td><td>${num(c.leads)}</td><td>${num(c.reach)}</td><td>${num(c.imp)}</td><td>${c.freq ? num(c.freq, 2) : '—'}</td>
      ${hasRevenue ? `<td>${c.revenue ? money(c.revenue, r.currency) : '—'}</td><td>${c.revenue && c.spend ? num(c.revenue / c.spend, 2) : '—'}</td>` : ''}</tr>`;
  };
  const head = `<tr><th>Cliente · resultado principal</th><th>Investimento</th><th>Resultados</th><th>Custo/resultado</th><th>Conversas</th><th>Leads</th><th>Alcance</th><th>Impressões</th><th>Freq.</th>${hasRevenue ? '<th>Receita</th><th>ROAS</th>' : ''}</tr>`;
  const pages = [];
  for (let i = 0; i < sorted.length; i += 11) {
    const chunk = sorted.slice(i, i + 11);
    const last = i + 11 >= sorted.length;
    pages.push(`<section class="ms-page">${top}<h3 class="ms-h">Desempenho por cliente (variação em relação a ${esc(prevMonth)})</h3>
      <table class="ms-t">${head}${chunk.map(line).join('')}
      ${last ? `<tr class="tot"><td class="l">Total da operação (R$)</td><td>${brl(T.spend)}</td><td>${num(T.results)}</td><td>${brl(cpr)}</td><td>${num(T.conv)}</td><td>${num(T.leads)}</td><td>${num(T.reach)}</td><td>${num(T.imp)}</td><td></td>${hasRevenue ? `<td>${brl(T.revenue)}</td><td>${T.spend ? num(T.revenue / T.spend, 2) : '—'}</td>` : ''}</tr>` : ''}</table>
      <div class="ms-note">Investimento e custo na moeda de cada conta. Verde = melhorou em relação ao mês anterior (custo menor; investimento, resultados maiores). Receita e ROAS aparecem só quando a conta registra valor de compra (pixel ou compras por mensagem).</div>${foot(pages.length + 2)}</section>`);
  }
  return `<style>${CSS}</style>${page1}${pages.join('')}`;
}
