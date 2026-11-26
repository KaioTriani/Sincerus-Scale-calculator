// PDF "Resumo do dia" (enviado às 8h sobre o dia anterior) no padrão visual da Sincerus:
// capa escura com faixa laranja, indicadores do dia, o que precisa de atenção, visão por cliente e
// anúncios ativos com gasto, alcance, interações, resultados, custo por resultado, orçamento e alerta de custo.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const cur = (c) => (c === 'USD' ? 'US$' : 'R$');
const money = (v, c = 'BRL') => (v == null || !Number.isFinite(v) ? '—' : `${cur(c)} ${num(v, 2)}`);

const CSS = `
@page { size: A4 portrait; margin: 12mm 12mm 14mm; }
@page :first { margin-top: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Poppins', Verdana, sans-serif; color: #12141A; font-size: 8.2pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cover { position: relative; margin: 0 -12mm 6mm; padding: 12mm 12mm 9mm; background: #12141A; color: #fff; overflow: hidden; }
.cover::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2.2mm; background: linear-gradient(90deg, #F76000, #FF8A1F 60%, #FFB36B); }
.cover .row { display: flex; justify-content: space-between; align-items: flex-start; }
.cover .k { color: #FF8A1F; font-size: 7.2pt; letter-spacing: .2em; text-transform: uppercase; font-weight: 600; }
.cover h1 { font-size: 22pt; line-height: 1.1; margin: 2mm 0 1.5mm; font-weight: 700; }
.cover h1 span { color: #FF8A1F; }
.cover .s { color: #A9ADB4; font-size: 8.6pt; }
.cover img { height: 13mm; }
.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.6mm; margin: 0 0 6mm; }
.kpi { background: #F7F7F8; border-radius: 2.5mm; padding: 3mm 3.2mm 2.6mm; border-top: 1.2mm solid #E2E3E5; }
.kpi.o { border-top-color: #F76000; } .kpi.r { border-top-color: #D23B2E; } .kpi.g { border-top-color: #19A35A; }
.kpi span { display: block; color: #5B6068; font-size: 6.4pt; text-transform: uppercase; letter-spacing: .07em; font-weight: 600; }
.kpi b { display: block; font-size: 13.5pt; margin: 1mm 0 .4mm; font-weight: 700; white-space: nowrap; }
.kpi em { font-style: normal; color: #8A8F98; font-size: 6.8pt; }
h2 { display: flex; align-items: center; gap: 2mm; font-size: 11pt; margin: 0 0 3mm; font-weight: 700; break-after: avoid; page-break-after: avoid; }
h2::before { content: ''; width: 1.4mm; height: 4.6mm; background: #F76000; border-radius: .6mm; }
h2 small { color: #8A8F98; font-weight: 400; font-size: 7.6pt; margin-left: auto; }
section { margin-bottom: 6.5mm; }
.att { display: grid; grid-template-columns: 1fr 1fr; gap: 2.2mm; }
.card { border: 1px solid #ECEDEF; border-left: 1.4mm solid #E8A100; border-radius: 1.8mm; padding: 2.2mm 3mm; break-inside: avoid; page-break-inside: avoid; }
.card.crit { border-left-color: #D23B2E; } .card.soon { border-left-color: #F76000; }
.card b { display: block; font-size: 8.4pt; }
.card .t { font-size: 7.8pt; margin-top: .4mm; }
.card .a { font-size: 7.2pt; color: #5B6068; margin-top: .6mm; }
.okbox { background: #EEF8F2; color: #0F6B3A; border-radius: 2mm; padding: 3mm 4mm; font-size: 8.6pt; }
table { width: 100%; border-collapse: collapse; }
th { text-align: right; font-size: 6.2pt; color: #5B6068; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; padding: 1.6mm 1.4mm; border-bottom: 1.4px solid #12141A; }
td { text-align: right; padding: 1.7mm 1.4mm; border-bottom: 1px solid #EEEFF1; font-size: 7.8pt; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
td.l { white-space: normal; }
tr { break-inside: avoid; page-break-inside: avoid; }
tr.tot td { font-weight: 700; border-top: 1.4px solid #12141A; border-bottom: none; }
.chip { display: inline-block; border-radius: 4mm; padding: .35mm 2mm; font-size: 6.6pt; font-weight: 600; white-space: nowrap; }
.chip.crit { background: #FDECEA; color: #B3261E; } .chip.high { background: #FFF1E5; color: #C24E00; } .chip.good { background: #E7F6EE; color: #11743F; }
.chip.flat { background: #F2F2F3; color: #5B6068; } .chip.idle { background: #F2F2F3; color: #8A8F98; } .chip.new { background: #EEF2FF; color: #3A4BB3; }
.client { margin-bottom: 6mm; }
.ch { display: flex; align-items: center; justify-content: space-between; background: #12141A; color: #fff; border-radius: 2mm 2mm 0 0; padding: 2.4mm 3.4mm; break-after: avoid; page-break-after: avoid; }
.ch b { font-size: 10.5pt; } .ch .m { font-size: 7.4pt; color: #C9CCD1; } .ch .m strong { color: #FF8A1F; }
.camp { display: flex; justify-content: space-between; align-items: center; background: #F7F7F8; padding: 1.6mm 3.4mm; font-size: 7.4pt; font-weight: 600; break-after: avoid; page-break-after: avoid; }
.camp span { color: #5B6068; font-weight: 400; }
.client table { margin-bottom: 1.5mm; }
.client td:first-child { padding-left: 3.4mm; max-width: 58mm; overflow: hidden; text-overflow: ellipsis; }
.paused { color: #8A8F98; font-size: 6.4pt; margin-left: 1mm; }
td.idle { color: #8A8F98; font-size: 7pt; white-space: normal; line-height: 1.5; }
.sys { border: 1px solid #ECEDEF; border-radius: 2mm; padding: 2.6mm 3.4mm; }
.sys li { font-size: 7.6pt; line-height: 1.55; }
.note { color: #8A8F98; font-size: 6.8pt; line-height: 1.5; margin-top: 2mm; }
`;

const CHIP = (a) => {
  if (a.alert === 'sem-resultado') return `<span class="chip crit">Sem resultado</span>`;
  if (a.alert === 'alto') return `<span class="chip high">▲ ${num(a.diff * 100)}% vs 7d</span>`;
  if (a.alert === 'bom') return `<span class="chip good">▼ ${num(Math.abs(a.diff) * 100)}% vs 7d</span>`;
  if (a.alert === 'sem-entrega') return `<span class="chip idle">Sem entrega</span>`;
  if (a.alert === 'novo') return `<span class="chip new">Sem histórico</span>`;
  if (a.alert === 'pouco') return `<span class="chip idle">Pouco gasto</span>`;
  return `<span class="chip flat">Na média</span>`;
};

// d: { dayLong, generated, kpis, attention[], clients[], sys[] | null, logo, rateNote }
export function buildDailyReportHtml(d) {
  const k = d.kpis;
  const kpis = [
    ['o', 'Investimento ontem', money(k.spend), k.spendNote],
    ['', 'Resultados', num(k.results), k.resultsNote],
    ['', 'Custo médio por resultado', money(k.cpr), 'referência; tipos de resultado variam'],
    ['', 'Alcance', num(k.reach), `${num(k.impressions)} impressões`],
    [k.costAlerts ? 'r' : 'g', 'Alertas de custo', num(k.costAlerts), `${num(k.ads)} anúncios ativos`],
  ].map(([c, t, v, n]) => `<div class="kpi ${c}"><span>${t}</span><b>${v}</b><em>${esc(n || '')}</em></div>`).join('');

  const att = d.attention.length
    ? `<div class="att">${d.attention.map((a) => `<div class="card ${a.tone}"><b>${esc(a.client)}</b><div class="t">${esc(a.text)}</div>${a.action ? `<div class="a">→ ${esc(a.action)}</div>` : ''}</div>`).join('')}</div>`
    : '<div class="okbox">✅ Nada pedindo atenção: saldos, pagamentos, entrega e custos dentro do esperado.</div>';

  const overview = `<table><tr><th>Cliente</th><th>Gasto ontem</th><th>Orçamento/dia</th><th>Resultados</th><th>Custo/res.</th><th>vs 7 dias</th><th>Alcance</th><th>Alertas</th></tr>
    ${d.clients.map((c) => `<tr><td class="l"><b>${esc(c.name)}</b></td><td>${money(c.spend, c.currency)}</td><td>${c.budgetDay ? money(c.budgetDay, c.currency) : '—'}</td><td>${num(c.results)}</td><td>${money(c.cpr, c.currency)}</td><td>${c.cpr && c.baseCpr ? CHIP({ alert: c.cpr > c.baseCpr * 1.3 ? 'alto' : c.cpr < c.baseCpr * 0.8 ? 'bom' : 'media', diff: c.cpr / c.baseCpr - 1 }) : '—'}</td><td>${num(c.reach)}</td><td>${c.alerts ? `<span class="chip crit">${c.alerts}</span>` : '<span class="chip good">0</span>'}</td></tr>`).join('')}</table>`;

  const clients = d.clients.filter((c) => c.campaigns.length).map((c) => `<div class="client">
    <div class="ch"><b>${esc(c.name)}</b><span class="m">Gasto ontem <strong>${money(c.spend, c.currency)}</strong> · ${num(c.results)} ${esc(c.resultShort)} · orçamento ${c.budgetDay ? `${money(c.budgetDay, c.currency)}/dia` : '—'}</span></div>
    ${c.campaigns.map((k) => `<div class="camp">${esc(k.name)}<span>${k.budget ? `Orçamento ${money(k.budget.value, c.currency)}${k.budget.per === 'dia' ? '/dia' : ' total'} (${k.budget.level})` : 'Sem orçamento informado'}</span></div>
      <table><tr><th>Anúncio</th><th>Gasto</th><th>Alcance</th><th>Interações</th><th>Resultados</th><th>Custo/res.</th><th>Média 7d</th><th>Alerta</th></tr>
      ${k.ads.map((a) => `<tr><td class="l">${esc(a.label)}${a.active ? '' : '<span class="paused">(pausado)</span>'}</td><td>${money(a.spend, c.currency)}</td><td>${num(a.reach)}</td><td>${num(a.interactions)}</td><td>${num(a.results)}</td><td>${money(a.cpr, c.currency)}</td><td>${money(a.baseCpr, c.currency)}</td><td>${CHIP(a)}</td></tr>`).join('')}
      ${k.idle?.length ? `<tr><td class="l idle" colspan="8"><span class="chip idle">Sem entrega ontem · ${k.idle.length}</span> ${esc(k.idle.join(' · '))}</td></tr>` : ''}
      </table>`).join('')}
  </div>`).join('');

  const sys = d.sys == null ? '<p class="note">Verificação do sistema ainda não executada hoje.</p>'
    : d.sys.length ? `<div class="sys"><ul style="margin:0;padding-left:4mm">${d.sys.map((i) => `<li><b>${esc(i.area)} · ${esc(i.nome)}:</b> ${esc(i.detalhe)}</li>`).join('')}</ul></div>`
    : '<div class="okbox">✅ Meta Ads, WhatsApp, e-mail e servidor funcionando.</div>';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo do dia ${esc(d.dayShort)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>
<div class="cover"><div class="row"><div><div class="k">Sincerus Scale · Relatório diário</div><h1>Resumo de <span>${esc(d.dayLong)}</span></h1><div class="s">${esc(d.generated)}</div></div>${d.logo ? `<img src="${d.logo}" alt="">` : ''}</div></div>
<div class="kpis">${kpis}</div>
<section><h2>Precisa de atenção <small>${d.attention.length} ponto(s)</small></h2>${att}</section>
<section><h2>Visão por cliente <small>ontem × média dos 7 dias anteriores</small></h2>${overview}
<div class="note">${esc(d.rateNote || '')} "Resultados" segue o indicador de cada anúncio (conversas, leads, visitas ao perfil…), como a coluna Resultados do Gerenciador. Alerta de custo: ▲ custo por resultado 30% ou mais acima da média dos 7 dias anteriores · ▼ 20% ou mais abaixo · "Sem resultado": gastou e não trouxe resultado.</div></section>
<section><h2>Anúncios ativos <small>${num(d.kpis.ads)} anúncios · dados de ontem</small></h2>${clients || '<p>Nenhum anúncio ativo.</p>'}</section>
<section><h2>Situação do sistema</h2>${sys}</section>
</body></html>`;
}
